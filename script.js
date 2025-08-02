const { createApp } = Vue;

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
        }
    }
}).mount('#app');
