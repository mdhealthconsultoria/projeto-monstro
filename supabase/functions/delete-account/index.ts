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

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Client autenticado como quem chamou — só pra confirmar a identidade a
  // partir do próprio JWT, nunca recebemos um user_id do corpo da
  // requisição (isso deixaria qualquer pessoa apagar a conta de outra).
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData.user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida.' }), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(callerData.user.id);
  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
