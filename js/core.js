// Load universe.json
function loadUniverse(callback) {
  fetch('universe.json')
    .then(res => res.json())
    .then(data => callback(data))
    .catch(err => console.error("Error loading universe.json:", err));
}

// Rotating banner (homepage)
let bannerIndex = 0;
function rotateBanner() {
  const banners = document.querySelectorAll('.banner img');
  if (banners.length === 0) return;
  banners.forEach((img, i) => img.classList.toggle('active', i === bannerIndex));
  bannerIndex = (bannerIndex + 1) % banners.length;
}
setInterval(rotateBanner, 4000);
