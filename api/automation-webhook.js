// Webhook para criar mapa mental de roteiro no projeto "Roteiros"
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const secret = process.env.AUTOMATION_WEBHOOK_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Env vars ausentes.' });

    const { user_email, title, text, project_name } = req.body || {};
    if (!user_email) return res.status(400).json({ error: 'Informe user_email.' });

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    // Buscar usuário
    const userResp = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(user_email)}&limit=1`, { headers });
    const users = await userResp.json().catch(() => []);
    if (!userResp.ok || !users[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const userId = users[0].id;

    // Buscar projeto "Roteiros" (ou project_name se informado)
    const targetProject = project_name || 'Roteiros';
    const projResp = await fetch(`${supabaseUrl}/rest/v1/projects?select=id,payload&user_id=eq.${userId}&name=eq.${encodeURIComponent(targetProject)}&limit=1`, { headers });
    const projects = await projResp.json().catch(() => []);
    let project = projects[0];
    let payload = project?.payload || { nodes: [], connections: [], view: { x: 0, y: 0, scale: 1 } };
    if (!Array.isArray(payload.nodes)) payload.nodes = [];
    if (!Array.isArray(payload.connections)) payload.connections = [];

    // Parsear roteiro em tópicos para o mapa mental
    const cleanTitle = String(title || 'Roteiro eFootball').slice(0, 120);
    const cleanText = String(text || '').slice(0, 4000);
    const linhas = cleanText.split('\n').filter(l => l.trim().length > 0);

    // Separar tópicos numerados
    const topicos = [];
    let topicoAtual = null;
    for (const linha of linhas) {
      const match = linha.match(/^(\d+)\.\s+(.+)/);
      if (match) {
        if (topicoAtual) topicos.push(topicoAtual);
        topicoAtual = { titulo: match[2].slice(0, 80), conteudo: '' };
      } else if (topicoAtual) {
        topicoAtual.conteudo += linha.trim() + ' ';
      }
    }
    if (topicoAtual) topicos.push(topicoAtual);
    if (topicos.length === 0) topicos.push({ titulo: cleanTitle, conteudo: cleanText.slice(0, 300) });

    const ts = Date.now();
    const baseX = 100 + (payload.nodes.length * 10);
    const baseY = 100 + (payload.nodes.length * 10);

    // Node central (título do roteiro)
    const centralId = `rot_${ts}_central`;
    payload.nodes.push({
      id: centralId,
      type: 'card',
      title: cleanTitle,
      note: '',
      x: baseX + 350,
      y: baseY + 200,
      width: 220,
      height: 80,
      bgColor: '#1a1a2e',
      textColor: '#ffffff',
      borderColor: '#e63946'
    });

    // Nodes dos tópicos ao redor
    const cores = ['#e8f4f8', '#fff3e0', '#e8f5e9', '#fce4ec', '#f3e5f5', '#e0f2f1', '#fff8e1'];
    topicos.forEach((topico, i) => {
      const angulo = (2 * Math.PI / topicos.length) * i - Math.PI / 2;
      const raio = 280;
      const nodeId = `rot_${ts}_t${i}`;
      const nx = baseX + 350 + Math.cos(angulo) * raio;
      const ny = baseY + 200 + Math.sin(angulo) * raio;

      payload.nodes.push({
        id: nodeId,
        type: 'card',
        title: topico.titulo,
        note: topico.conteudo.trim().slice(0, 300),
        x: nx,
        y: ny,
        width: 180,
        height: 100,
        bgColor: cores[i % cores.length],
        borderColor: '#cccccc'
      });

      // Conexão com o central
      payload.connections.push({
        id: `conn_${ts}_${i}`,
        from: centralId,
        to: nodeId,
        style: 'curved',
        color: '#cccccc',
        width: 2
      });
    });

    // Salvar no projeto
    if (project?.id) {
      const upd = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${project.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ payload })
      });
      if (!upd.ok) return res.status(500).json({ error: 'Falha ao atualizar projeto.' });
    } else {
      const ins = await fetch(`${supabaseUrl}/rest/v1/projects`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId, name: targetProject, payload })
      });
      if (!ins.ok) return res.status(500).json({ error: 'Falha ao criar projeto.' });
    }

    return res.status(200).json({ ok: true, created_node_id: centralId, topicos: topicos.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
