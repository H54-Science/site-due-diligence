/* ==========================================================================
   Fonction serverless Cloudflare Pages — /api/contact

   Reçoit la soumission du formulaire de contact et crée une entrée dans une
   base de données Notion. Aucune clé n'est écrite dans ce fichier : le jeton
   d'intégration Notion et l'ID de la base sont lus depuis les variables
   d'environnement configurées dans le tableau de bord Cloudflare Pages
   (Settings → Environment variables), donc jamais commités dans le dépôt.

   Variables d'environnement attendues :
     - NOTION_TOKEN        : jeton de l'intégration interne Notion
     - NOTION_DATABASE_ID  : ID de la base de données Notion cible

   La base Notion doit contenir exactement ces propriétés (mêmes noms,
   mêmes types) :
     - "Nom"      → type Titre (title)
     - "Email"    → type Email
     - "Message"  → type Texte (rich text)
     - "Date"     → type Date

   Voir le README du projet pour la marche à suivre complète (création de
   l'intégration, partage de la base, récupération des identifiants).
   ========================================================================== */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let email = '';
    let message = '';
    let honeypot = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = (body.name || '').toString().trim();
      email = (body.email || '').toString().trim();
      message = (body.message || '').toString().trim();
      honeypot = (body._gotcha || '').toString().trim();
    } else {
      // multipart/form-data ou application/x-www-form-urlencoded
      const form = await request.formData();
      name = (form.get('name') || '').toString().trim();
      email = (form.get('email') || '').toString().trim();
      message = (form.get('message') || '').toString().trim();
      honeypot = (form.get('_gotcha') || '').toString().trim();
    }

    // Piège à robots rempli : on répond succès sans rien envoyer, pour ne
    // pas indiquer au bot que le champ est surveillé.
    if (honeypot) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (name.length < 2 || !emailValid || message.length < 10) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
      return new Response(JSON.stringify({ ok: false, error: 'server_not_configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: env.NOTION_DATABASE_ID },
        properties: {
          'Nom': { title: [{ text: { content: name } }] },
          'Email': { email: email },
          'Message': { rich_text: [{ text: { content: message } }] },
          'Date': { date: { start: new Date().toISOString() } }
        }
      })
    });

    if (!notionResponse.ok) {
      const errText = await notionResponse.text();
      return new Response(JSON.stringify({ ok: false, error: 'notion_error', detail: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'unexpected', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
