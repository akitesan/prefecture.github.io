const { createApp } = Vue;
const config = {
    apiKey: "AIzaSyAjBXKNDW7DGy5kL6Ec84RL29fv1GbqlPs",
    authDomain: "visitedprefecture.firebaseapp.com",
    projectId: "visitedprefecture"
};
firebase.initializeApp(config);
const auth = firebase.auth();
const db = firebase.firestore();

createApp({
    data() {
        return {
            svgMap: '',
            visited: {},
            isLoggedIn: false,
            userName: '',
            userId: '',
            users: [],
            selectedUser: '',
            currentUser: null,
        };
    },
    computed: {
        isCurrentUserMap() {
            return this.selectedUser === this.userId;
        },
        otherUsers() {
            return this.users.filter(user => user.uid !== this.userId);
        }
    },
    mounted() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.isLoggedIn = true;
                this.userId = user.uid;
                this.userName = user.displayName;
                this.currentUser = { uid: user.uid, displayName: user.displayName };
                this.selectedUser = this.userId; // 初期表示は自分
                const userDocRef = db.collection("users").doc(user.uid);
                const userDoc = await userDocRef.get();
                if (!userDoc.exists) {
                    // 存在しない場合は、displayNameを保存
                    await userDocRef.set({
                        displayName: user.displayName || '名無し'
                    }, { merge: true });
                }
                this.fetchUsers();
            } else {
                window.location.href = 'login.html';
            }
        });
        fetch('map-full.svg')
            .then(res => res.text())
            .then(svg => {
                this.svgMap = svg;
            });
    },

    methods: {
        togglePrefecture(event) {
            if (!this.isCurrentUserMap) {
                alert("他のユーザーの地図は編集できません。");
                return;
            }
            if (!this.isLoggedIn) {
                alert("ログインしてください。");
                return;
            }
            const g = event.target.closest('g[data-code]');
            if (!g) return;
            const code = g.getAttribute('data-code');
            this.visited[code] = !this.visited[code];
            g.classList.toggle('visited');
            this.saveRemoteData();
        },
        applyVisitedStyles() {
            this.$nextTick(() => {
                document.querySelectorAll('g[data-code]').forEach(g => {
                    g.classList.remove('visited', 'other-user-visited');
                });
                const className = this.isCurrentUserMap ? 'visited' : 'other-user-visited';
                Object.keys(this.visited).forEach(code => {
                    if (this.visited[code]) {
                        const g = document.querySelector(`g[data-code="${code}"]`);
                        if (g) g.classList.add(className);
                    }
                });
            });
        },
        async fetchUsers() {
            const snapshot = await db.collection("users").get();
            this.users = snapshot.docs.map(doc => ({
                uid: doc.id,
                displayName: doc.data().displayName || '名無し'
            }));
            this.fetchUserData();
        },
        async fetchUserData() {
            if (!this.selectedUser) return;
            const doc = await db.collection("users").doc(this.selectedUser).get();
            if (doc.exists) {
                const data = doc.data();
                const { displayName, ...visitedData } = data;
                this.visited = visitedData;
            } else {
                this.visited = {};
            }
            this.applyVisitedStyles();
        },
        async saveRemoteData() {
            if (!this.userId) return;
            await db.collection("users").doc(this.userId).set(
                { ...this.visited, displayName: this.userName },
                { merge: true }
            );
        },
        async deleteMyData() {
            const user = auth.currentUser;
            if (!user) {
                alert("ログインしていません。");
                return;
            }

            if (confirm("本当にご自分のアカウントと全ての訪問履歴を削除してもよろしいですか？この操作は元に戻せません。")) {
                try {
                    await db.collection("users").doc(this.userId).delete();
                    console.log("Firestore document successfully deleted!");

                    await user.delete();
                    console.log("User account successfully deleted!");

                    alert("アカウントと訪問履歴が削除されました。");
                } catch (error) {
                    console.error("Error deleting account: ", error);
                    if (error.code === 'auth/requires-recent-login') {
                        alert("セキュリティのため、アカウントを削除するには再ログインが必要です。一度ログアウトし、再度ログインしてからお試しください。");
                        auth.signOut();
                    } else {
                        alert("アカウントの削除中にエラーが発生しました。時間を置いてからもう一度お試しください。");
                    }
                }
            }
        },
        logout() {
            auth.signOut();
        }
    },
}).mount('#app');