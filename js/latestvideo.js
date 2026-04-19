// ============================================================
// latestvideo.js
// Fetches the latest YouTube video via RSS and renders it.
// To update your channel: change CHANNEL_ID below.
// ============================================================

const CHANNEL_ID = "UCaMmvhH9KDxSlsjcTPdyvkw"; // <-- paste your UC... ID here

function loadLatestVideo(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // YouTube's public RSS feed — no API key needed
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  // We use a CORS proxy because browsers block direct RSS fetches
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;

  container.innerHTML = `<p style="color:#aaa;">Loading latest video...</p>`;

  fetch(proxyUrl)
    .then(res => res.json())
    .then(data => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(data.contents, "text/xml");

      const entry = xml.querySelector("entry"); // first = latest video
      if (!entry) {
        container.innerHTML = `<p style="color:#aaa;">No videos found.</p>`;
        return;
      }

      const title     = entry.querySelector("title")?.textContent || "Latest Video";
      const videoId   = entry.querySelector("videoId")?.textContent || "";
      const published = entry.querySelector("published")?.textContent || "";
      const link      = entry.querySelector("link")?.getAttribute("href") || "#";
      const thumb     = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

      const date = published
        ? new Date(published).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
        : "";

      container.innerHTML = `
        <div class="latest-video-card">
          <a href="${link}" target="_blank" rel="noopener" class="latest-video-thumb-wrap">
            <img src="${thumb}" alt="${title}" class="latest-video-thumb">
            <div class="latest-video-play">▶</div>
          </a>
          <div class="latest-video-info">
            <a href="${link}" target="_blank" rel="noopener" class="latest-video-title">${title}</a>
            ${date ? `<p class="latest-video-date">${date}</p>` : ""}
            <a href="https://www.youtube.com/channel/${CHANNEL_ID}" target="_blank" rel="noopener" class="latest-video-channel-link">
              📺 View Channel
            </a>
          </div>
        </div>
      `;
    })
    .catch(() => {
      container.innerHTML = `<p style="color:#aaa;">Could not load latest video right now.</p>`;
    });
}

// Auto-run on any page that has a #latest-video-container element
loadLatestVideo("latest-video-container");
