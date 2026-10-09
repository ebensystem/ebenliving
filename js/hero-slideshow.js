'use strict';

(() => {
  const heroImage = document.querySelector('.hero-card > img');
  if (!heroImage) return;

  const secondImage = new Image();
  secondImage.onload = () => {
    const images = ['/assets/inicio.jpg', '/assets/inicio2.jpg'];
    let current = 0;
    window.setInterval(() => {
      if (document.hidden) return;
      current = (current + 1) % images.length;
      heroImage.src = images[current];
    }, 5000);
  };
  secondImage.src = '/assets/inicio2.jpg';
})();
