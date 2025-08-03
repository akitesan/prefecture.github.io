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
            currentUser: null
        };
    },
    computed: {
        isCurrentUserMap() {
            return this.selectedUser === this.userId;
        },
        otherUsers() {
            return this.users.filter(user => user.uid !== this.userId);
        },
        sortedPrefecturesWithComments() {
            const sortedKeys = Object.keys(this.prefectureNames).sort((a, b) => {
                return parseInt(a, 10) - parseInt(b, 10);
            });
            return sortedKeys
                .map(code => ({
                    code,
                    name: this.prefectureNames[code],
                    data: this.visited[code] || {
                        lastVisited: null,
                        comment: this.editedComments[code] || ''
                    }
                }));
        }
    },
    mounted() {
        auth.onAuthStateChanged(async (user) => {
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
                const parser = new DOMParser();
                const doc = parser.parseFromString(svg, "image/svg+xml");
                const names = {};
                doc.querySelectorAll('g[data-code]').forEach(g => {
                    const code = g.getAttribute('data-code');
                    const titleElement = g.querySelector('title');
                    if (titleElement) {
                        const titleText = titleElement.textContent.trim();
                        const japaneseName = titleText.split('/')[0].trim();
                        names[code] = japaneseName;
                    }
                });
                this.prefectureNames = names;

                // SVGがDOMに挿入された後にスタイルとイベントリスナーを適用
                this.$nextTick(() => {
                    this.applyVisitedStyles();
                    // イベントリスナーを一度だけ設定
                    const mapContainer = document.getElementById('map-container');
                    if (mapContainer) {
                        mapContainer.addEventListener('click', this.togglePrefecture);
                    }
                });
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

            if (this.visited[code] && this.visited[code].lastVisited) {
                delete this.visited[code];
            } else {
                this.visited[code] = {
                    lastVisited: new Date().toISOString(),
                    comment: this.editedComments[code] || ''
                };
            }
            this.applyVisitedStyles();
            this.saveRemoteData();
        },
        applyVisitedStyles() {
            this.$nextTick(() => {
                const className = this.isCurrentUserMap ? 'visited' : 'other-user-visited';
                const otherClassName = this.isCurrentUserMap ? 'other-user-visited' : 'visited';

                document.querySelectorAll('g[data-code]').forEach(g => {
                    g.classList.remove(className, otherClassName);
                    const code = g.getAttribute('data-code');
                    if (this.visited[code] && this.visited[code].lastVisited) {
                        g.classList.add(className);
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

                const processedVisitedData = {};
                for (const key in visitedData) {
                    if (visitedData[key] && visitedData[key].lastVisited) {
                        processedVisitedData[key] = {
                            lastVisited: visitedData[key].lastVisited,
                            comment: visitedData[key].comment || ''
                        };
                    } else if (visitedData[key] === true) {
                        processedVisitedData[key] = {
                            lastVisited: null,
                            comment: ''
                        };
                    }
                }
                this.visited = processedVisitedData;

                this.editedComments = {};
                for (const code in this.prefectureNames) {
                    this.editedComments[code] = this.visited[code]?.comment || '';
                }
            } else {
                this.visited = {};
                this.editedComments = {};
                for (const code in this.prefectureNames) {
                    this.editedComments[code] = '';
                }
            }
            this.applyVisitedStyles();
        },
        async saveRemoteData() {
            if (!this.userId) return;
            try {
                await db.collection("users").doc(this.userId).set(
                    { ...this.visited, displayName: this.userName },
                    { merge: true }
                );
            } catch (error) {
                console.error("データの更新中にエラーが発生しました: ", error);
            }
        },
        updateComment(code) {
            if (!this.isCurrentUserMap) {
                alert("他のユーザーの地図は編集できません。");
                return;
            }
            if (!this.visited[code]) {
                this.visited[code] = { lastVisited: null, comment: '' };
            }
            this.visited[code].comment = this.editedComments[code];
        },
        toggleSidebar() {
            this.isSidebarVisible = !this.isSidebarVisible;
        },
        logout() {
            auth.signOut();
        },
        deleteMyData() {
            const user = auth.currentUser;
            if (!user) {
                alert("ログインしていません。");
                return;
            }

            if (confirm("本当にご自分のアカウントと全ての訪問履歴を削除してもよろしいですか？この操作は元に戻せません。")) {
                try {
                    db.collection("users").doc(this.userId).delete();
                    console.log("Firestore document successfully deleted!");

                    user.delete();
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
        }
    }
}).mount('#app');