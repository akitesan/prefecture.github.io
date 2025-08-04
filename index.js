// index.js

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
            prefectures: [],
            visited: {},
            comments: {},
            isLoggedIn: false,
            userName: '',
            userId: '',
            users: [],
            selectedUser: '',
            currentUser: null,
            isLoading: true,
            isPublic: false,
            hideNoCommentPrefectures: false,
            isLoading: true
        };
    },
    computed: {
        isCurrentUserList() {
            return this.selectedUser === this.userId;
        },
        otherUsers() {
            return this.users.filter(user => user.uid !== this.userId);
        },
        sortedPrefectures() {
            let list = [...this.prefectures].sort((a, b) => a.code - b.code);
            if (this.hideNoCommentPrefectures) {
                list = list.filter(prefecture => this.comments[prefecture.code] && this.comments[prefecture.code].trim() !== '');
            }
            return list;
        }
    },
    async mounted() {
        await new Promise(resolve => auth.onAuthStateChanged(resolve));

        const user = auth.currentUser;
        if (user) {
            this.isLoggedIn = true;
            this.userId = user.uid;
            this.userName = user.displayName;
            this.currentUser = { uid: user.uid, displayName: user.displayName };
            this.selectedUser = this.userId;

            // ユーザーデータが存在しない場合は作成
            const userDocRef = db.collection("users").doc(user.uid);
            await userDocRef.set({
                displayName: user.displayName || '名無し',
                isPublic: false
            }, { merge: true });

            // ユーザーと都道府県データの両方を並行して取得
            await Promise.all([
                this.fetchUsers(),
                this.initializePrefectures()
            ]);

            this.isLoading = false;
        } else {
            window.location.href = 'login.html';
        }
    },
    methods: {
        // 都道府県リストの初期化をメソッドとして分離
        initializePrefectures() {
            const prefectureNames = [
                '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
                '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
                '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
                '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
                '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
                '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
                '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
            ];
            this.prefectures = prefectureNames.map((name, index) => ({
                code: (index + 1).toString().padStart(2, '0'),
                name: name
            }));
        },
        async fetchUsers() {
            try {
                const snapshot = await db.collection("users").get();
                this.users = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    displayName: doc.data().displayName || '名無し',
                    isPublic: doc.data().isPublic || false
                }));
                this.fetchUserData();
            } catch (error) {
                console.error("Error fetching users:", error);
                alert("ユーザーリストの取得中にエラーが発生しました。");
            }
        },
        async fetchUserData() {
            if (!this.selectedUser) return;
            try {
                const doc = await db.collection("users").doc(this.selectedUser).get();
                if (doc.exists) {
                    const data = doc.data();
                    const { displayName, isPublic, comments, ...visitedData } = data;

                    this.isPublic = isPublic;
                    if (!this.isCurrentUserList && !isPublic) {
                        alert("このユーザーのリストは非公開です。");
                        this.visited = {};
                        this.comments = {};
                        this.isPublic = false;
                    } else {
                        // visitedDataをboolean値に変換し、visitedオブジェクトを更新
                        this.visited = Object.fromEntries(
                            Object.entries(visitedData).map(([key, value]) => [key, !!value])
                        );
                        this.comments = comments || {};
                    }
                } else {
                    this.visited = {};
                    this.comments = {};
                    this.isPublic = false;
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                alert("データの取得中にエラーが発生しました。");
            }
        },
        async saveCommentsAndVisited() {
            if (!this.isCurrentUserList) {
                alert("他のユーザーのデータは保存できません。");
                return;
            }
            if (!this.userId) return;

            try {
                // visitedオブジェクトを保存用に整形
                const visitedData = Object.fromEntries(
                    Object.entries(this.visited).filter(([_, value]) => value)
                );

                await db.collection("users").doc(this.userId).set(
                    {
                        ...visitedData,
                        comments: this.comments,
                        displayName: this.userName,
                        isPublic: this.isPublic
                    },
                    { merge: true }
                );
            } catch (error) {
                console.error("Error saving data: ", error);
                alert("データの保存中にエラーが発生しました。");
            }
        },
        async togglePublic() {
            this.isPublic = !this.isPublic;
            this.saveCommentsAndVisited();
            alert(`リストを${this.isPublic ? '公開' : '非公開'}にしました。`);
        },
        toggleNoCommentPrefectures() {
            this.hideNoCommentPrefectures = !this.hideNoCommentPrefectures;
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
    }
}).mount('#app');