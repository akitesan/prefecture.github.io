const { createApp } = Vue;

createApp({
    data() {
        return {
            svgMap: '',
            visited: JSON.parse(localStorage.getItem('visited') || '{}')
        };
    },
    mounted() {
        fetch('japan.svg')
            .then(res => res.text())
            .then(svg => {
                this.svgMap = svg;
                this.applyVisitedStyles();
            });
    },
    methods: {
        togglePrefecture(event) {
            if (!event.target.id.startsWith('JP-')) return;
            const id = event.target.id;
            this.visited[id] = !this.visited[id];
            localStorage.setItem('visited', JSON.stringify(this.visited));
            event.target.classList.toggle('visited');
        },
        applyVisitedStyles() {
            this.$nextTick(() => {
                for (const id in this.visited) {
                    if (this.visited[id]) {
                        const el = document.getElementById(id);
                        if (el) el.classList.add('visited');
                    }
                }
            });
        }
    }
}).mount('#app');