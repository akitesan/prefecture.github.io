
// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyAjBXKNDW7DGy5kL6Ec84RL29fv1GbqlPs",
    authDomain: "visitedprefecture.firebaseapp.com",
    projectId: "visitedprefecture"
};
// Firebaseを初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ログイン状態を監視し、ログイン済みならindex.htmlへ遷移
auth.onAuthStateChanged(user => {
    if (user) {
        window.location.href = 'index.html';
    }
});

// ログインボタンのクリックイベントを設定
document.getElementById('google-login-btn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            console.log("ログイン成功:", result.user.displayName);
        })
        .catch(error => {
            console.error("ログイン失敗:", error.message);
        });
});