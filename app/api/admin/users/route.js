import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qhizuqcdxivdvjtefofz.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json(
    { error: 'Configuração do servidor pendente: SUPABASE_SERVICE_ROLE_KEY. Cadastre-a em Environment no Render e aplique um novo deploy. Nunca coloque essa chave no GitHub.' },
    { status: 503 }
  );

  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const token = bearer.slice(7).trim();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('is_super_admin,status').eq('id', auth.user.id).maybeSingle();
  if (profileError || !profile?.is_super_admin || profile.status !== 'active') {
    return NextResponse.json({ error: 'Somente o Super Admin pode cadastrar usuários.' }, { status: 403 });
  }

  let input;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }

  const email = String(input?.email || '').trim().toLowerCase();
  const fullName = String(input?.full_name || '').trim();
  const password = input?.password;
  if (!isEmail(email) || fullName.length < 2 || fullName.length > 150 ||
      typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return NextResponse.json(
      { error: 'Informe nome, e-mail válido e senha com 12 a 128 caracteres.' },
      { status: 400 }
    );
  }

  // A API oficial cria o usuário sem manipular diretamente as tabelas de auth.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created?.user) {
    return NextResponse.json({ error: createError?.message || 'Não foi possível cadastrar o usuário.' }, { status: 400 });
  }

  const newId = created.user.id;
  const { error: saveError } = await admin.from('profiles').upsert({
    id: newId, full_name: fullName, status: 'active', is_super_admin: false
  }, { onConflict: 'id' });
  if (saveError) {
    await admin.auth.admin.deleteUser(newId);
    return NextResponse.json({ error: 'Não foi possível criar o perfil. Operação revertida.' }, { status: 500 });
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    user_id: auth.user.id, action: 'user_create',
    entity_type: 'profile', entity_id: newId,
    after: { email, full_name: fullName, is_super_admin: false }
  });

  return NextResponse.json({
    id: newId, email, full_name: fullName,
    warning: auditError ? 'Usuário criado, mas falhou o registro de auditoria. Revise os logs.' : null
  }, { status: 201 });
}
