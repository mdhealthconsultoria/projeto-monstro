// Apaga a conta de verdade (a linha em auth.users), coisa que só o
// service_role consegue fazer — por isso isso precisa ser uma Edge Function
// e nunca pode rodar no client. Todo o resto (profiles, user_app_state,
// participação em comunidades, benchmark_stats, etc.) tem FK com
// "on delete cascade" pra auth.users (ou pra profiles, que também cascateia),
// então apagar o usuário aqui já limpa o banco inteiro sozinho.
//
// Deploy: ver o passo a passo que acompanha esta entrega (supabase CLI,
// projeto jqrehtqwkeoiredbvjiy). Não precisa de nenhum secret novo —
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente
// dentro de toda Edge Function do projeto.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// O navegador manda um preflight OPTIONS antes de qualquer requisição
// cross-origin com Authorization — sem responder isso com os cabeçalhos
// certos, o preflight falha e o navegador bloqueia a requisição real
// inteira (nunca chega a rodar o resto da função), fazendo o app cair no
// fallback antigo em silêncio mesmo com a function publicada e saudável.
//
// Em vez de uma lista fixa de headers permitidos (que quebra de novo toda
// vez que o supabase-js ou o client wrapper do app mandar um header novo —
// foi exatamente isso que aconteceu com Cache-Control/Pragma, que o
// supabaseClient.js adiciona em toda requisição), reflete de volta
// exatamente o que o navegador perguntou no preflight.
function corsHeaders(req: Request) {
  const requested = req.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': requested || 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405, cors);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Não autenticado.' }, 401, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Client autenticado como quem chamou — só pra confirmar a identidade a
  // partir do próprio JWT, nunca recebemos um user_id do corpo da
  // requisição (isso deixaria qualquer pessoa apagar a conta de outra).
  const callerClient = createClient(supabaseUrl!, anonKey!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData.user) {
    return json({ error: 'Sessão inválida.' }, 401, cors);
  }

  const adminClient = createClient(supabaseUrl!, serviceRoleKey!);
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(callerData.user.id);
  if (deleteErr) {
    return json({ error: deleteErr.message }, 500, cors);
  }

  return json({ ok: true }, 200, cors);
});
