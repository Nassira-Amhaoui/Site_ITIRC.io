const API_BASE = '/api';

let currentStudentSemester = 'S1';
let modalMode = null;
let editingUid = null;
let chartUsers, chartVisitors;

// ===========================
// Affichage des vues
// ===========================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.style.display = v.id === id ? 'block' : 'none');
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.section === id));
}

function populateProfileForm(user) {
  const firstNameEl = document.getElementById('firstName');
  const lastNameEl  = document.getElementById('lastName');
  const emailEl     = document.getElementById('emailInput');

  if (firstNameEl) firstNameEl.value = user.firstName || '';
  if (lastNameEl)  lastNameEl.value  = user.lastName  || '';
  if (emailEl)     emailEl.value     = user.email     || '';
}

// ===========================
// Initialisation DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
const uid = localStorage.getItem('uid');
  const role = localStorage.getItem('role');
  const semester = localStorage.getItem('semester');

  if (!uid || !role) {
    alert('Aucun utilisateur connecté !');
    window.location.href = '/authentification.html';
    return;
  }

  let docRef;
  if (role === 'admins') {
    docRef = db.collection('users').doc('rolesDoc').collection('admins').doc(uid);
  } else if (role === 'profs') {
    docRef = db.collection('users').doc('rolesDoc').collection('profs').doc(uid);
  } else if (role === 'etudiants') {
    if (!semester) throw new Error("Semestre non défini !");
    docRef = db.collection('users')
               .doc('rolesDoc')
               .collection('etudiants')
               .doc(semester)
               .collection(semester)
               .doc(uid);
  } else {
    throw new Error("Rôle inconnu");
  }

  try {
    // --- Charger le profil
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new Error('Utilisateur introuvable');
    const user = docSnap.data();

    // Remplir formulaire
    document.getElementById('firstName').value = user.firstName || '';
    document.getElementById('lastName').value  = user.lastName  || '';
    document.getElementById('emailInput').value = user.email   || '';

    // Sidebar
    document.getElementById('sidebarName').textContent =
      `${user.firstName || ''} ${user.lastName || ''}`.trim();
    document.getElementById('sidebarEmail').textContent = user.email || 'Email non défini';
    if (user.photoURL) document.getElementById('sidebarProfilePhoto').src = user.photoURL;

    // --- Sauvegarder modifications
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const firstName = document.getElementById('firstName').value.trim();
      const lastName  = document.getElementById('lastName').value.trim();

      if (!firstName || !lastName) return alert("Veuillez remplir tous les champs.");

      try {
        await docRef.update({ firstName, lastName });
        alert("Profil mis à jour avec succès !");

        // Sidebar maj
        document.getElementById('sidebarName').textContent = `${firstName} ${lastName}`;

        // localStorage maj
        const userLocal = { uid, role, firstName, lastName, email: user.email };
        localStorage.setItem('user', JSON.stringify(userLocal));

      } catch (err) {
        console.error("[ERROR] Échec update :", err);
        alert("Erreur lors de la mise à jour du profil.");
      }
    });

  } catch (err) {
    console.error(err);
    alert("Impossible de charger le profil.");
    localStorage.clear();
    window.location.href = '/authentification.html';
  }




  // --- Toggle mot de passe ---
  document.getElementById('togglePasswordForm')?.addEventListener('click', () => {
    document.getElementById('passwordForm').classList.toggle('hidden');
  });
document.getElementById('savePasswordBtn')?.addEventListener('click', async () => {
  const oldPassword = document.getElementById('oldPassword').value.trim();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  if (!oldPassword || !newPassword || !confirmPassword)
    return alert("Veuillez remplir tous les champs du mot de passe.");

  if (newPassword !== confirmPassword)
    return alert("Le nouveau mot de passe et sa confirmation ne correspondent pas.");

  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.uid) throw new Error("Utilisateur non connecté.");

    // Référence Firestore
    const adminRef = db.collection('users')
                       .doc('rolesDoc')
                       .collection('admins')
                       .doc(user.uid);

    const docSnap = await adminRef.get();
    if (!docSnap.exists) throw new Error("Utilisateur introuvable dans Firestore.");

    const currentData = docSnap.data();
    if (currentData.regNo !== oldPassword) 
      return alert("Ancien mot de passe incorrect !");

    // Mise à jour du mot de passe
    await adminRef.update({ regNo: newPassword });
    alert("Mot de passe mis à jour avec succès.");

    // Mettre à jour localStorage
    user.regNo = newPassword;
    localStorage.setItem('user', JSON.stringify(user));

    // Optionnel : déconnexion
    localStorage.clear();
    window.location.href = '/authentification.html';

  } catch (err) {
    console.error('[ERROR] Changement mot de passe Firestore :', err);
    alert("Impossible de changer le mot de passe : " + err.message);
  }
});



  // --- Déconnexion ---
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/authentification.html';
  });

  // --- Navigation ---
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showView(link.dataset.section);
    });
  });

  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
  });

  // --- Gestion des tabs étudiants par semestre ---
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentStudentSemester = btn.dataset.sem;
    loadStudentsForSemester(currentStudentSemester);
  }));

  // --- Modals ---
  document.getElementById('btn-add-teacher')?.addEventListener('click', () => openModal('add-teacher'));
  document.getElementById('btn-add-student')?.addEventListener('click', () => openModal('add-student'));
  document.getElementById('m-cancel')?.addEventListener('click', closeModal);
  document.getElementById('m-save')?.addEventListener('click', onModalSave);
  document.getElementById('m-add-sem').addEventListener('click', () => addSemesterInput());

  // --- Charts ---
  initCharts();
  await refreshAll();
});

// ===========================
// Charts
// ===========================
function initCharts() {
  const ctxU = document.getElementById('chartUsers').getContext('2d');
  chartUsers = new Chart(ctxU, {
    type: 'bar',
    data: { labels: ['Admins', 'Profs', 'Étudiants'], datasets: [{ label: 'Utilisateurs', data: [0,0,0], backgroundColor: ['#2C3E50','#2980B9','#27AE60'], borderRadius: 10 }] },
    options: { indexAxis: 'y', responsive: true }
  });
}

// ===========================
// Chargement données
// ===========================
async function loadHomeStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const j = await res.json();
    const c = j.counts || {};

    chartUsers.data.datasets[0].data = [
      c.admin || 0,
      c.prof || 0,
      c.etudiant || 0
    ];
    chartUsers.update();
  } catch (err) {
    console.error(err);
  }
}


// ===========================
// Gestion enseignants / étudiants
// ===========================
async function loadTeachers() {
  const tbody = document.querySelector('#teachers-table tbody');
  tbody.innerHTML = '<tr><td colspan="7">Chargement…</td></tr>';

  try {
    const snapshot = await db.collection('users')
                             .doc('rolesDoc')
                             .collection('profs')
                             .get();

    const profs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    tbody.innerHTML = '';
    if (!profs.length) {
      tbody.innerHTML = '<tr><td colspan="7">Aucun professeur trouvé.</td></tr>';
      return;
    }

    profs.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.lastName||'')}</td>
        <td>${escapeHtml(p.firstName||'')}</td>
        <td>${escapeHtml(p.email||'')}</td>
        <td>${escapeHtml(p.regNo||'')}</td>
        
        <td>
          <button data-uid="${p.uid}" data-action="edit">Modifier</button>
          <button data-uid="${p.uid}" data-action="delete">Supprimer</button>
        </td>`;
      tbody.appendChild(tr);
// --- Ajouter les classes CSS pour le style ---
    tr.querySelector('[data-action="edit"]').classList.add('table-btn', 'edit');
    tr.querySelector('[data-action="delete"]').classList.add('table-btn', 'delete');
    tr.querySelector('[data-action="edit"]').addEventListener('click', () => openModal('edit-teacher', p.uid));
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteUser(p.uid, 'profs'));


    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Erreur: ${err.message}</td></tr>`;
    console.error(err);
  }
}

async function loadStudentsForSemester(sem) {
  const tbody = document.querySelector('#students-table tbody');
  tbody.innerHTML = '<tr><td colspan="6">Chargement…</td></tr>';

  try {
    const snapshot = await db.collection('users')
                             .doc('rolesDoc')
                             .collection('etudiants')
                             .doc('semestres')
                             .collection(sem)
                             .get();

    const students = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    tbody.innerHTML = '';
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="6">Aucun étudiant trouvé pour ${sem}.</td></tr>`;
      return;
    }

    students.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(s.lastName || '')}</td>
        <td>${escapeHtml(s.firstName || '')}</td>
        <td>${escapeHtml(s.regNo || '')}</td>
        <td>${escapeHtml(s.email || '')}</td>
        
        <td>
          <button data-uid="${s.uid}" data-action="edit">Modifier</button>
          <button data-uid="${s.uid}" data-action="delete">Supprimer</button>
        </td>`;
      tbody.appendChild(tr);
     tr.querySelector('[data-action="edit"]').classList.add('table-btn', 'edit');
     tr.querySelector('[data-action="delete"]').classList.add('table-btn', 'delete');
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => openModal('edit-student', s.uid));
      tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteUser(s.uid));
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Erreur: ${err.message}</td></tr>`;
    console.error(err);
  }
}


// ===========================
// Modal ajout / modification
// ===========================
function openModal(mode, uid=null){
  modalMode = mode; editingUid = uid;
  const isTeacher = mode.includes('teacher');
  document.getElementById('modal-title').textContent = (mode.startsWith('add')?'Ajouter':'Modifier') + (isTeacher?' professeur':' étudiant');

  // Reset champs
  document.getElementById('m-firstname').value='';
  document.getElementById('m-lastname').value='';
  document.getElementById('m-email').value='';
  document.getElementById('m-regno').value='';
  document.getElementById('m-role').value = isTeacher?'prof':'etudiant';
  document.getElementById('m-semesters-list').innerHTML='';

  // Ajouter automatiquement le semestre sélectionné dans le tab pour l'étudiant
  if (!isTeacher && currentStudentSemester) {
    addSemesterInput(currentStudentSemester, []); // pas de modules par défaut
  }



    document.getElementById('m-semesters-container').style.display = 'none';
  document.getElementById('modal').style.display = 'flex';
if (uid) {
  if (modalMode.includes('teacher')) {
    // Prof
    const profRef = db.collection('users')
                      .doc('rolesDoc')
                      .collection('profs')
                      .doc(uid);
    profRef.get().then(docSnap => {
      if (!docSnap.exists) return console.warn('Professeur introuvable');
      const u = docSnap.data();
      document.getElementById('m-firstname').value = u.firstName || '';
      document.getElementById('m-lastname').value = u.lastName || '';
      document.getElementById('m-email').value = u.email || '';
      document.getElementById('m-regno').value = u.regNo || '';
      if(u.courseTypes){
        Array.from(document.getElementById('m-course-type').options).forEach(opt => {
          if(u.courseTypes.includes(opt.value)) opt.selected = true;
        });
      }
    }).catch(console.warn);

  } else if (modalMode.includes('student')) {
    // Étudiant
    const studentRef = db.collection('users')
                         .doc('rolesDoc')
                         .collection('etudiants')
                         .doc('semestres')
                         .collection(currentStudentSemester)
                         .doc(uid);

    studentRef.get().then(docSnap => {
      if (!docSnap.exists) return console.warn('Étudiant introuvable');
      const u = docSnap.data();
      document.getElementById('m-firstname').value = u.firstName || '';
      document.getElementById('m-lastname').value = u.lastName || '';
      document.getElementById('m-email').value = u.email || '';
      document.getElementById('m-regno').value = u.regNo || '';
    }).catch(console.warn);
  }
}

  }

function closeModal(){document.getElementById('modal').style.display='none'; modalMode=null; editingUid=null;}
function addSemesterInput(name='',modules=[]){
  const div=document.createElement('div'); div.className='m-sem';
  const semInput=document.createElement('input'); semInput.placeholder='Ex: S1'; semInput.value=name;
  const modulesInput=document.createElement('input'); modulesInput.placeholder='Modules (séparés par ,)'; modulesInput.value=(modules.join?modules.join(', '):modules||'');
  const removeBtn=document.createElement('button'); removeBtn.className='btn ghost small'; removeBtn.textContent='Suppr'; removeBtn.addEventListener('click',()=>div.remove());
  div.appendChild(semInput); div.appendChild(modulesInput); div.appendChild(removeBtn);
  document.getElementById('m-semesters-list').appendChild(div);
}
async function onModalSave() {
  const firstName = document.getElementById('m-firstname').value.trim();
  const lastName = document.getElementById('m-lastname').value.trim();
  const email = document.getElementById('m-email').value.trim();
  const regNo = document.getElementById('m-regno').value.trim();
  const role = document.getElementById('m-role').value;

  if (!firstName || !lastName || !email || !regNo) {
    document.getElementById('m-msg').textContent = 'Erreur: Tous les champs obligatoires doivent être remplis.';
    return;
  }

  try {
    let uid;
    if (modalMode.startsWith('add')) {
      // --- Créer utilisateur Firebase Auth ---
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, regNo);
      uid = userCredential.user.uid;
    } else if (modalMode.startsWith('edit')) {
      if (!editingUid) throw new Error('UID manquant');
      uid = editingUid;
    }

    // --- Préparer données ---
    const userData = {
      firstName,
      lastName,
      email,
      regNo,
      role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (modalMode.startsWith('add')) userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    // --- Enregistrement Firestore selon rôle ---
    if (role === 'profs') {
      // Professeur
      const courseTypesSelect = document.getElementById('m-course-type');
      userData.courseTypes = courseTypesSelect ? Array.from(courseTypesSelect.selectedOptions).map(o => o.value) : [];
      userData.semesters = Array.from(document.querySelectorAll('#m-semesters-list .m-sem')).map(div => ({
        name: div.querySelector('input:nth-child(1)').value.trim(),
        modules: div.querySelector('input:nth-child(2)').value.split(',').map(m => m.trim()).filter(m => m)
      }));

      const profRef = db.collection('users').doc('rolesDoc').collection('profs').doc(uid);
      if (modalMode.startsWith('add')) await profRef.set(userData);
      else await profRef.update(userData);

    } else if (role === 'etudiants') {
      // Étudiant → enregistrer uniquement dans le semestre sélectionné
      if (!currentStudentSemester) throw new Error("Semestre actuel non défini !");
      const studentRef = db.collection('users')
                           .doc('rolesDoc')
                           .collection('etudiants')
                           .doc('semestres')
                           .collection(currentStudentSemester)
                           .doc(uid);

      userData.semester = currentStudentSemester; // pour référence rapide
      userData.modules = []; // modules vides par défaut, l’admin pourra les ajouter

      if (modalMode.startsWith('add')) await studentRef.set(userData);
      else await studentRef.update(userData);

    } else {
      throw new Error("Rôle inconnu pour l'enregistrement");
    }

    console.log(`[SUCCESS] ${role} ${modalMode.startsWith('add')?'ajouté':'modifié'} :`, uid);
    closeModal();
    await refreshAll();

  } catch (err) {
    console.error('[ERROR] Ajout/Modification utilisateur :', err);
    document.getElementById('m-msg').textContent = 'Erreur: ' + err.message;
  }
}


// ===========================
// Supprimer utilisateur
// ===========================
async function deleteUser(uid, roleCollection) {
  if (!confirm('Supprimer cet utilisateur ?')) return;

  try {
    if (!roleCollection) throw new Error("Nom de sous-collection manquant");

    // Chemin Firestore correct
    const userRef = db.collection('users')
                      .doc('rolesDoc')
                      .collection(roleCollection)
                      .doc(uid);

    const docSnap = await userRef.get();
    if (!docSnap.exists) throw new Error("Utilisateur introuvable");

    await userRef.delete();

    alert('Utilisateur supprimé avec succès !');
    await refreshAll();

  } catch (err) {
    console.error('[ERROR] Suppression utilisateur :', err);
    alert('Impossible de supprimer : ' + err.message);
  }
}


// ===========================
// Utilitaires
// ===========================
function renderSemestersSummary(semesters=[]){return semesters.map(s=>`<strong>${escapeHtml(s.name||s)}</strong>: ${escapeHtml((s.modules||[]).join(',')||'-')}`).join('<br/>')||'-';}
function renderModulesSummary(modules=[]){return modules.join(',')||'-';}
function escapeHtml(s){if(!s)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}

// ===========================
// Rafraîchir toutes les données
// ===========================
async function refreshAll() {
  await loadHomeStats();
  await loadTeachers();
  await loadStudentsForSemester(currentStudentSemester);
}






let editingModuleUid = null;
window.allProfs = []; // Liste globale des profs

// ===============================
// Charger tous les profs
// ===============================
async function loadProfs() {
  try {
    const snapshot = await db
      .collection('users')
      .doc('rolesDoc')
      .collection('profs')
      .get();

    window.allProfs = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    console.log('Profs chargés :', window.allProfs);

    if (window.allProfs.length > 0) {
      document.getElementById('m-add-prof').disabled = false;
    }
  } catch (err) {
    console.error('Erreur chargement profs :', err);
  }
}

// ===============================
// Ouvrir modal module
// ===============================
function openModulesModal(mode = 'add', uid = null) {
  editingModuleUid = uid;

  document.getElementById('modules-modal-title').textContent =
    mode === 'add' ? 'Ajouter Module' : 'Modifier Module';
  document.getElementById('m-modules-msg').textContent = '';
  document.getElementById('m-module-name').value = '';
  document.getElementById('m-module-order').value = '';
  document.getElementById('m-module-semester').value = 'S1';
  document.getElementById('m-module-profs-list').innerHTML = '';

  if (uid) {
    db.collection('modules')
      .doc(uid)
      .get()
      .then(doc => {
        if (!doc.exists) return alert('Module introuvable');
        const m = doc.data();
        document.getElementById('m-module-name').value = m.name || '';
        document.getElementById('m-module-order').value = m.ordre || '';
        document.getElementById('m-module-semester').value =
          m.semestre || 'S1';
        if (m.profs && Array.isArray(m.profs)) {
          m.profs.forEach(p => addProfInput(p.uid, p.type));
        }
      });
  }

  document.getElementById('modules-modal').style.display = 'flex';
}

// ===============================
// Fermer modal
// ===============================
function closeModulesModal() {
  document.getElementById('modules-modal').style.display = 'none';
}

// ===============================
// Ajouter un input prof
// ===============================
function addProfInput(uid = '', type = []) {
  if (!window.allProfs || window.allProfs.length === 0) {
    alert('Liste des professeurs non chargée. Actualisez la page.');
    return;
  }

  const div = document.createElement('div');
  div.className = 'm-prof';
  div.style.marginBottom = '5px';

  div.innerHTML = `
    <select class="prof-select">
      ${window.allProfs
        .map(
          p =>
            `<option value="${p.uid}" ${
              p.uid === uid ? 'selected' : ''
            }>${p.firstName} ${p.lastName}</option>`
        )
        .join('')}
    </select>

    <select class="prof-type" multiple>
      <option value="CM" ${type?.includes("CM") ? "selected" : ""}>CM</option>
      <option value="TD" ${type?.includes("TD") ? "selected" : ""}>TD</option>
      <option value="TP" ${type?.includes("TP") ? "selected" : ""}>TP</option>
    </select>

    <button type="button" class="btn ghost small">Suppr</button>
  `;

  div.querySelector('button').addEventListener('click', () => div.remove());

  document.getElementById('m-module-profs-list').appendChild(div);
}

// ===============================
// Listeners
// ===============================
document
  .getElementById('btn-add-module')
  .addEventListener('click', () => openModulesModal('add'));

document
  .getElementById('m-add-prof')
  .addEventListener('click', () => addProfInput());

document
  .getElementById('m-cancel-module')
  .addEventListener('click', closeModulesModal);

// ===============================
// Enregistrer module
// ===============================
document.getElementById('m-save-module').addEventListener('click', async () => {
  const name = document.getElementById('m-module-name').value.trim();
  const ordre = parseInt(
    document.getElementById('m-module-order').value,
    10
  );
  const semestre = document.getElementById('m-module-semester').value;

  if (!name || !ordre || !semestre) {
    document.getElementById('m-modules-msg').textContent =
      'Tous les champs sont obligatoires';
    return;
  }

  const profs = Array.from(
    document.querySelectorAll('#m-module-profs-list .m-prof')
  ).map(div => {
    const typeSelect = div.querySelector('.prof-type');
    const types = Array.from(typeSelect.selectedOptions).map(opt => opt.value);
    return {
      uid: div.querySelector('.prof-select').value,
      type: types, // tableau de types
    };
  });

  try {
    const moduleRef = editingModuleUid
      ? db.collection('modules').doc(editingModuleUid)
      : db.collection('modules').doc();

    await moduleRef.set(
      { name, ordre, semestre, profs },
      { merge: true }
    );

    alert('Module enregistré avec succès !');
    closeModulesModal();
    loadModules();
  } catch (err) {
    document.getElementById('m-modules-msg').textContent = err.message;
  }
});

// ===============================
// Charger modules
// ===============================
async function loadModules() {
  const tbody = document.querySelector('#modules-table tbody');
  tbody.innerHTML = '<tr><td colspan="5">Chargement…</td></tr>';

  try {
    const snapshot = await db.collection('modules').get();
    const modules = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    tbody.innerHTML = '';

    if (!modules.length) {
      tbody.innerHTML =
        '<tr><td colspan="5">Aucun module trouvé.</td></tr>';
      return;
    }

    modules.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.name || '-'}</td>
        <td>${m.semestre || '-'}</td>
        <td>${m.ordre || '-'}</td>
        <td>
          ${(m.profs || [])
            .map(p => {
              const prof = window.allProfs.find(x => x.uid === p.uid);
              return prof
                ? `${prof.firstName} ${prof.lastName} (${Array.isArray(p.type) ? p.type.join(", ") : p.type})`
                : p.uid;
            })
            .join('<br>')}
        </td>
        <td>
          <button data-uid="${m.uid}" data-action="edit">Modifier</button>
          <button data-uid="${m.uid}" data-action="delete">Supprimer</button>
        </td>
      `;
      tbody.appendChild(tr);

      tr.querySelector('[data-action="edit"]').addEventListener('click', () =>
        openModulesModal('edit', m.uid)
      );
      tr.querySelector('[data-action="delete"]').addEventListener('click', () =>
        deleteModule(m.uid)
      );
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erreur: ${err.message}</td></tr>`;
  }
}

// ===============================
// Supprimer module
// ===============================
async function deleteModule(uid) {
  if (!confirm('Supprimer ce module ?')) return;
  try {
    await db.collection('modules').doc(uid).delete();
    alert('Module supprimé avec succès !');
    loadModules();
  } catch (err) {
    alert('Erreur: ' + err.message);
  }
}

// ===============================
// Initialisation
// ===============================
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('m-add-prof').disabled = true;
  await loadProfs();
  await loadModules();
});
