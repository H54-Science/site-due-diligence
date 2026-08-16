/* ==========================================================================
   Due diligence scientifique — script minimal
   Deux responsabilités seulement :
     1. les apparitions au scroll (Intersection Observer)
     2. l'envoi du formulaire de contact vers /api/contact (fonction
        serverless Cloudflare Pages qui relaie vers Notion)
   Aucune dépendance externe.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Apparitions au scroll
     Chaque élément .reveal passe en .is-visible lorsqu'il entre dans le champ
     de vision. L'observation s'arrête ensuite : l'animation ne se rejoue pas.
     ---------------------------------------------------------------------- */
  function setupReveal() {
    var elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Sans Intersection Observer ou avec animations réduites : tout est
    // affiché immédiatement, sans transition.
    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      // Déclenche un peu avant que l'élément ne soit complètement visible,
      // et pas trop bas pour que l'animation reste perceptible sur mobile.
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08
    });

    elements.forEach(function (el) { observer.observe(el); });

    // Léger décalage entre éléments voisins d'un même groupe (max 3 crans),
    // pour éviter un effet de bloc trop mécanique.
    document.querySelectorAll('.method-list, .cards, .prose').forEach(function (group) {
      var items = group.querySelectorAll('.reveal');
      items.forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', Math.min(i, 3) * 0.08 + 's');
      });
    });
  }

  /* ------------------------------------------------------------------------
     2. Formulaire de contact
     Envoi en arrière-plan vers l'action du formulaire (/api/contact), qui
     est une fonction serverless (voir /functions/api/contact.js) chargée de
     créer l'entrée dans Notion. Si JavaScript est désactivé, le navigateur
     soumet le formulaire normalement vers la même URL : la fonction sait lire
     aussi bien du JSON qu'un envoi de formulaire classique.
     ---------------------------------------------------------------------- */
  function setupForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var status = form.querySelector('.form-status');
    var submit = form.querySelector('button[type="submit"]');

    function setStatus(message, state) {
      if (!status) return;
      status.textContent = message;
      if (state) {
        status.setAttribute('data-state', state);
      } else {
        status.removeAttribute('data-state');
      }
    }

    // Validation manuelle (le formulaire porte novalidate) : on veut des
    // messages en français homogènes plutôt que les bulles du navigateur.
    function validate(data) {
      var fields = [
        { el: form.elements.name, ok: data.name.length > 1 },
        { el: form.elements.email, ok: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) },
        { el: form.elements.message, ok: data.message.length > 9 }
      ];

      var firstInvalid = null;

      fields.forEach(function (field) {
        if (field.ok) {
          field.el.removeAttribute('aria-invalid');
        } else {
          field.el.setAttribute('aria-invalid', 'true');
          if (!firstInvalid) firstInvalid = field.el;
        }
      });

      if (firstInvalid) {
        firstInvalid.focus();
        setStatus('Merci de compléter les champs signalés.', 'error');
        return false;
      }

      return true;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim()
      };

      // Le piège à robots est resté vide : on s'arrête sans rien dire.
      if (form.elements._gotcha && form.elements._gotcha.value) return;

      if (!validate(data)) return;

      var action = form.getAttribute('action') || '';

      setStatus('Envoi en cours…');
      if (submit) submit.disabled = true;

      fetch(action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          form.reset();
          setStatus('Message envoyé. Je vous réponds sous 24 heures.', 'success');
        })
        .catch(function () {
          var fallback = form.getAttribute('data-email');
          setStatus(
            'L\'envoi a échoué.' + (fallback ? ' Vous pouvez écrire directement à ' + fallback + '.' : ''),
            'error'
          );
        })
        .then(function () {
          if (submit) submit.disabled = false;
        });
    });
  }

  /* ------------------------------------------------------------------------
     3. Année courante dans le pied de page
     ---------------------------------------------------------------------- */
  function setupYear() {
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  }

  setupReveal();
  setupForm();
  setupYear();
})();
