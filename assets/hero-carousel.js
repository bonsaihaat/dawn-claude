(function () {
  class HeroCarousel extends HTMLElement {
    connectedCallback() {
      this.slides = Array.from(this.querySelectorAll('[data-slide]'));
      this.dots = Array.from(this.querySelectorAll('[data-dot]'));
      this.prevButton = this.querySelector('[data-prev]');
      this.nextButton = this.querySelector('[data-next]');
      this.activeIndex = this.slides.findIndex((slide) => slide.classList.contains('is-active'));
      if (this.activeIndex === -1) this.activeIndex = 0;

      this.autoplayMs = Number(this.dataset.autoplayMs) || 5000;
      this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => this.goTo(this.activeIndex - 1, true));
      }
      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => this.goTo(this.activeIndex + 1, true));
      }
      this.dots.forEach((dot, index) => {
        dot.addEventListener('click', () => this.goTo(index, true));
      });

      if (this.slides.length > 1 && !this.reducedMotion) {
        this.startAutoplay();
      }
    }

    disconnectedCallback() {
      clearInterval(this._timer);
    }

    goTo(index, isManual) {
      if (this.slides.length === 0) return;
      const next = (index + this.slides.length) % this.slides.length;
      this.slides[this.activeIndex].classList.remove('is-active');
      this.dots[this.activeIndex] && this.dots[this.activeIndex].classList.remove('is-active');
      this.dots[this.activeIndex] && this.dots[this.activeIndex].setAttribute('aria-selected', 'false');
      this.activeIndex = next;
      this.slides[this.activeIndex].classList.add('is-active');
      this.dots[this.activeIndex] && this.dots[this.activeIndex].classList.add('is-active');
      this.dots[this.activeIndex] && this.dots[this.activeIndex].setAttribute('aria-selected', 'true');

      if (isManual) this.startAutoplay();
    }

    startAutoplay() {
      clearInterval(this._timer);
      this._timer = setInterval(() => this.goTo(this.activeIndex + 1, false), this.autoplayMs);
    }
  }

  customElements.define('hero-carousel', HeroCarousel);
})();
