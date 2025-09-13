// Affichage et soumission du formulaire
const form = document.getElementById('testimonialForm');
const btnToggle = document.querySelector('.btn-toggle-form');
const testimonialsList = document.getElementById('testimonialsList');

// Toggle du formulaire
btnToggle.addEventListener('click', () => {
  form.classList.toggle('hidden');
  form.scrollIntoView({ behavior: 'smooth' });
});

// Soumission du formulaire
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nom: document.getElementById('nom').value,
    prenom: document.getElementById('prenom').value,
    promotion: document.getElementById('promotion').value,
    poste: document.getElementById('poste').value,
    entreprise: document.getElementById('entreprise').value,
    parcours: document.getElementById('parcours').value,
    conseils: document.getElementById('conseils').value
  };

  try {
    const response = await fetch('http://localhost:5000/api/temoignages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (result.success) {
      alert('Témoignage ajouté avec succès !');
      form.reset();
      form.classList.add('hidden');
      loadTestimonials(); // rafraîchit la liste
    } else {
      alert('Erreur : ' + result.message);
    }
  } catch (err) {
    console.error(err);
    alert('Erreur serveur.');
  }
});

// Charger les témoignages depuis Firestore
async function loadTestimonials() {
  testimonialsList.innerHTML = '';

  try {
    const response = await fetch('http://localhost:5000/api/temoignages'); // ← changer 3000 en 5000
    const result = await response.json();

    if (result.success) {
      result.temoignages.forEach(t => {
        const div = document.createElement('div');
        div.classList.add('testimonial-item');
        div.innerHTML = `
          <h3>${t.nom} ${t.prenom}</h3>
          <span>Promotion : ${t.promotion || '-'}</span>
          <p><strong>Poste :</strong> ${t.poste} - <strong>Entreprise :</strong> ${t.entreprise || '-'}</p>
          <p><strong>Parcours :</strong> ${t.parcours || '-'}</p>
          <p><strong>Conseils :</strong> ${t.conseils || '-'}</p>
        `;
        testimonialsList.appendChild(div);
      });
    }
  } catch (err) {
    console.error(err);
    alert('Erreur lors du chargement des témoignages.');
  }
}

// Charger au démarrage
loadTestimonials();
