const { createApp } = Vue;

const config = {
    apiKey: "API_KEY",
    authDomain: "AUTH_DOMAIN",
    projectId: "PROJECT_ID"
};  

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let userId = null;

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

createApp({
    data() {
        let visited = {};
        try {
            const raw = localStorage.getItem('visited');
            if (raw) visited = JSON.parse(raw);
        } catch (e) {
            // 不正な値の場合は初期化
            localStorage.removeItem('visited');
        }
        return {
            svgMap: '',
            visited
        };
    },
    mounted() {
        const auth = firebase.auth();
        fetch('map-full.svg')
            .then(res => res.text())
            .then(svg => {
                this.svgMap = svg;
                this.applyVisitedStyles();
            });
    },
    methods: {
        togglePrefecture(event) {
            const g = event.target.closest('g[data-code]');
            if (!g) return;
            const code = g.getAttribute('data-code');
            this.visited[code] = !this.visited[code];
            localStorage.setItem('visited', JSON.stringify(this.visited));
            g.classList.toggle('visited');
            this.saveRemoteData(); // ← サーバーにも保存
        },
        applyVisitedStyles() {
            this.$nextTick(() => {
                Object.keys(this.visited).forEach(code => {
                    if (this.visited[code]) {
                        const g = document.querySelector(`g[data-code="${code}"]`);
                        if (g) g.classList.add('visited');
                    }
                });
            });
        },
        async fetchRemoteData() {
            if (!this.userId) return;
            const doc = await db.collection("users").doc(this.userId).get();
            if (doc.exists) {
                this.visited = doc.data();
                this.applyVisitedStyles();
            }
        },
        async saveRemoteData() {
            if (!this.userId) return;
            await db.collection("users").doc(this.userId).set(this.visited);
        },

    }
}).mount('#app');
