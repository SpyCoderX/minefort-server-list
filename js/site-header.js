class SiteHeader extends HTMLElement {
  connectedCallback() {
    fetch("/components/header.html")
      .then(res => res.text())
      .then(html => {
        this.innerHTML = html;
      })
      .catch(err => {
        console.error("Could not load header:", err);
      });
  }
}
customElements.define("site-header", SiteHeader);