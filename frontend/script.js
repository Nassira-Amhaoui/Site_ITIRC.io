// Example interactivity
function openSection(section) {
    alert(`Opening ${section} section... 🚀`);
  }
  
  // Example: simulate earning coins
  let coins = 120;
  setInterval(() => {
    // simulate earning 1 coin every 5 seconds
    coins++;
    document.getElementById('coin-count').textContent = coins;
  }, 5000);
  