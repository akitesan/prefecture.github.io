const { createApp } = Vue;

const config = {
    apiKey: "API_KEY",
    authDomain: "AUTH_DOMAIN",
    projectId: "PROJECT_ID"
};

// Firebaseの初期化
firebase.initializeApp(config);
const auth = firebase.auth();
const db = firebase.firestore();

let userId = null; // ログインユーザーのIDを保持する変数

// Googleログイン処理
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            console.log("ログイン成功:", user.displayName);
        })
        .catch(error => {
            console.error("ログイン失敗:", error.message);
        });
}

// Vueアプリケーションの作成
createApp({
    data() {
        return {
            svgMap: '',
            visited: {}, // ローカルストレージを使わないため、初期値は空のオブジェクト
            isLoggedIn: false // ログイン状態を管理するフラグ
        };
    },
    mounted() {
        // ログイン状態の監視
        // ユーザーのログイン/ログアウト状態が変わるたびに実行される
        auth.onAuthStateChanged(user => {
            if (user) {
                // ログインしている場合
                this.isLoggedIn = true;
                this.userId = user.uid; // userIdをセット
                console.log("ログイン済み:", user.displayName);
                this.fetchRemoteData(); // Firebaseからデータを取得
            } else {
                // ログアウトしている場合
                this.isLoggedIn = false;
                this.userId = null;
                this.visited = {}; // ログアウトしたらデータをクリア
                this.applyVisitedStyles(); // スタイルをリセット
                console.log("ログアウト済み");
            }
        });

        // SVGの読み込みはログイン状態に関係なく行う
        fetch('map-full.svg')
            .then(res => res.text())
            .then(svg => {
                this.svgMap = svg;
                // 初期描画後、ログイン状態に応じてスタイルを適用
                this.applyVisitedStyles();
            });
    },
    methods: {
        togglePrefecture(event) {
            // ログインしていない場合は処理を中断
            if (!this.isLoggedIn) {
                alert("ログインして利用してください。");
                return;
            }

            const g = event.target.closest('g[data-code]');
            if (!g) return;
            const code = g.getAttribute('data-code');
            this.visited[code] = !this.visited[code];
            // ローカルストレージへの保存処理を削除

            // クラスの切り替えは直接Vueのデータ変更で反映されるようにする
            // DOM操作を直接行うより、Vueのデータバインディングに任せる方が良い
            // ただし、この場合はSVGの内部を直接操作する必要があるため、以下の処理は残しておく
            g.classList.toggle('visited');

            // Firebaseにデータを保存
            this.saveRemoteData();
        },
        applyVisitedStyles() {
            // visitedデータに基づいてスタイルを適用
            this.$nextTick(() => {
                // すべての都道府県のvisitedクラスを一度リセット
                document.querySelectorAll('g[data-code]').forEach(g => {
                    g.classList.remove('visited');
                });
                // 新しいvisitedデータに基づいてクラスを適用
                Object.keys(this.visited).forEach(code => {
                    if (this.visited[code]) {
                        const g = document.querySelector(`g[data-code="${code}"]`);
                        if (g) g.classList.add('visited');
                    }
                });
            });
        },
        logout() {
            auth.signOut()
                .then(() => {
                    console.log("ログアウトしました。");
                })
                .catch(error => {
                    console.error("ログアウト失敗:", error);
                });
        },
        async fetchRemoteData() {
            // userIdがなければデータを取得しない
            if (!this.userId) return;

            // Firestoreからデータを取得
            const doc = await db.collection("users").doc(this.userId).get();
            if (doc.exists) {
                // データが存在する場合、visitedを更新
                this.visited = doc.data();
                this.applyVisitedStyles(); // スタイルを再適用
            } else {
                // データが存在しない場合、visitedを初期化
                this.visited = {};
                this.applyVisitedStyles();
            }
        },
        async saveRemoteData() {
            // userIdがなければデータを保存しない
            if (!this.userId) return;

            // Firestoreにデータを保存
            await db.collection("users").doc(this.userId).set(this.visited);
            console.log("データをFirebaseに保存しました。");
        },
        loginWithGoogle: loginWithGoogle // methodsにログイン関数を登録
    }
}).mount('#app');

// ログインボタンのクリックイベントを設定
// HTML側で `<button @click="loginWithGoogle">Googleでログイン</button>` とすることも可能
// document.getElementById('login-btn').addEventListener('click', loginWithGoogle);