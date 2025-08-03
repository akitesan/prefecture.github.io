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
            prefectures: [],
            comments: {},
            isLoading: true,
            error: null,
            currentView: 'map',
            isMobileView: false,
            isPublic: false, // 公開/非公開の状態を追加
        };
    },
    computed: {
        isCurrentUserMap() {
            return this.selectedUser === this.userId;
        },
        otherUsers() {
            return this.users.filter(user => user.uid !== this.userId);
        },
        sortedPrefectures() {
            return [...this.prefectures].sort((a, b) => a.code - b.code);
        }
    },
    async mounted() {
        const userPromise = new Promise(resolve => {
            auth.onAuthStateChanged(resolve);
        });

        const user = await userPromise;
        if (user) {
            this.isLoggedIn = true;
            this.userId = user.uid;
            this.userName = user.displayName;
            this.currentUser = { uid: user.uid, displayName: user.displayName };
            this.selectedUser = this.userId;
            const userDocRef = db.collection("users").doc(user.uid);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                await userDocRef.set({
                    displayName: user.displayName || '名無し',
                    isPublic: false // 初回ログイン時に非公開に設定
                }, { merge: true });
            }
            this.fetchUsers();
        } else {
            window.location.href = 'login.html';
        }

        const response = await fetch('map-full.svg');
        this.svgMap = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.svgMap, "image/svg+xml");
        const prefectureElements = doc.querySelectorAll('g.prefecture');

        this.prefectures = Array.from(prefectureElements).map(el => {
            const code = el.getAttribute('data-code');
            const titleElement = el.querySelector('title');
            let name = '';
            const fullTitle = titleElement.textContent;
            name = fullTitle.split(' / ')[0].trim();
            return { code: code, name: name };
        });
        this.isLoading = false;
        this.checkScreenSize();
        window.addEventListener('resize', this.checkScreenSize);
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
                displayName: doc.data().displayName || '名無し',
                isPublic: doc.data().isPublic || false // isPublic の状態を取得
            }));
            this.fetchUserData();
        },
        async fetchUserData() {
            if (!this.selectedUser) return;
            const doc = await db.collection("users").doc(this.selectedUser).get();
            if (doc.exists) {
                const data = doc.data();
                const {
                    displayName,
                    isPublic,
                    comments,
                    ...visitedData
                } = data;
                this.visited = visitedData;
                this.comments = comments || {};
                this.isPublic = isPublic; // 公開状態を更新
                if (!this.isCurrentUserMap && !isPublic) {
                    alert("このユーザーの地図は非公開です。");
                    this.visited = {};
                    this.comments = {};
                    this.isPublic = false;
                } else {
                    this.visited = visitedData;
                    this.comments = comments || {};
                    this.isPublic = isPublic;
                }
            } else {
                this.visited = {};
                this.comments = {};
                this.isPublic = false;
            }
            this.applyVisitedStyles();
        },
        async saveRemoteData() {
            if (!this.userId) return;
            await db.collection("users").doc(this.userId).set(
                {
                    ...this.visited,
                    displayName: this.userName,
                    isPublic: this.isPublic // isPublic の状態を保存
                }, {
                merge: true
            }
            );
        },
        async saveComments() {
            if (!this.isCurrentUserMap) {
                alert("他のユーザーのコメントは保存できません。");
                return;
            }
            if (!this.userId) return;
            try {
                await db.collection("users").doc(this.userId).set(
                    {
                        comments: this.comments
                    },
                    {
                        merge: true
                    }
                );
                alert("コメントを保存しました。");
            } catch (error) {
                console.error("Error saving comments: ", error);
                alert("コメントの保存中にエラーが発生しました。");
            }
        },
        async togglePublic() {
            this.isPublic = !this.isPublic;
            this.saveRemoteData();
            alert(`地図を${this.isPublic ? '公開' : '非公開'}にしました。`);
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
        },
        toggleView(view) {
            this.currentView = view;
        },
        checkScreenSize() {
            // 画面幅が768px未満かどうかを判定
            this.isMobileView = window.innerWidth < 768;
        },
    },
    beforeUnmount() {
        // コンポーネントが破棄される前にリスナーを削除
        window.removeEventListener('resize', this.checkScreenSize);
    }
}).mount('#app');