const API = "/graphql";

class AutoIndex extends HTMLElement {
    // Attributes
    alreadyRendering = false;

    static get observedAttributes() {
        return ["depth", "path"];
    }

    get depth() {
        return parseInt(this.getAttribute("depth")) || 1;
    }

    set depth(value) {
        this.setAttribute("depth", value);
    }

    get path() {
        let p = this.getAttribute("path") || window.location.pathname;
        if (p.startsWith("/")) p = p.slice(1);
        if (/[a-zA-Z]{2}\//.test(p)) p = p.slice(3);
        return p;
    }

    set path(value) {
        this.setAttribute("path", value);
    }

    // Lifecycle
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(_name, _oldValue, _newValue) {
        this.render();
    }

    async getPageTree(pageId, level = 0) {
        // Get page tree
        let pageTreeRequest = await fetch(API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                    query {
                        pages {
                            tree(parent: ${pageId}, mode: ALL, locale: "") {
                                id
                                title
                                path
                                pageId
                            }
                        }
                    }
                `
            }),
        });

        let tree = (await pageTreeRequest.json()).data.pages.tree;

        if (level < this.depth) {
            for (let page of tree) {
                page.children = await this.getPageTree(page.id, level + 1);
            }
        }

        return tree;
    }

    async getPageDetail(pageId) {
        // Get page data
        let pageTreeRequest = await fetch(API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                    query {
                        pages {
                            single(id: ${pageId}) {
                                id
                                title
                                description
                                path
                            }
                        }
                    }
                `
            }),
        });

        return (await pageTreeRequest.json()).data.pages.single;
    }

    async renderTree(tree, level = 0) {
        let container = document.createElement("div");

        for (let page of tree) {
            let pageElement = document.createElement("p");

            if (level != this.depth) pageElement.style.fontSize = `${Math.max(1, 1.4-(level/10))}rem`;
            pageElement.style.textIndent = `${level}rem`;

            let a = document.createElement("a");
            a.href = `/${page.path}`;
            a.textContent = page.title;

            pageElement.appendChild(a);
            container.appendChild(pageElement);
            
            if (level != this.depth) {
                if (!page.pageId) continue;
                if (page.children.length == 0) continue;
                let data = await this.getPageDetail(page.pageId);
                if (!data) continue;

                let description = document.createElement("sup");

                description.textContent = data.description;
                description.style.textIndent = `${level}rem`;
                description.style.display = "inline-block";

                container.appendChild(description);
            }

            if (page.children) {
                let childrenNodes = await this.renderTree(page.children, level + 1)
                if (childrenNodes) container.appendChild(childrenNodes);
            }

            if (level == 0) container.appendChild(document.createElement("hr"));
        }

        if (container.childElementCount == 0) return null;

        return container;
    }

    async render() {
        if (this.alreadyRendering) return;
        this.alreadyRendering = true;

        const { depth } = this;

        this.innerHTML = `<h1 style="margin: 0;">Index</h1>`;

        let treeList = document.createElement("ul");

        // Get current page ID by path
        let currentPageRequest = await fetch(API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // TODO: add auth from cookie
            },
            body: JSON.stringify({
                query: `
                    query {
                        pages {
                            tree(path: "${this.path}", mode: ALL, locale: "") {
                                id
                                path
                            }
                        }
                    }
                `,
            }),
        });

        let currentPageTree = await currentPageRequest.json();
        const currentPageId = currentPageTree.data.pages.tree.find((page) => page.path === this.path).id;

        // Get page tree
        const pageTree = await this.getPageTree(currentPageId);

        // Render page tree
        this.appendChild(await this.renderTree(pageTree));

        this.alreadyRendering = false;
    }
}

export default AutoIndex;