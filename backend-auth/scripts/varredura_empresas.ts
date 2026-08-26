import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[VARREDURA] Iniciando busca por usuários sem empresa...');
  
  const orphanedUsers = await prisma.user.findMany({
    where: { tenantId: null }
  });

  if (orphanedUsers.length === 0) {
    console.log('[VARREDURA] Nenhum usuário órfão encontrado. Tudo certo!');
    return;
  }

  console.log(`[VARREDURA] Foram encontrados ${orphanedUsers.length} usuários sem empresa.`);

  // O GestorNex é o app padrão do sistema
  const gestorNex = await prisma.app.findFirst({ where: { name: 'GestorNex' } });

  for (const user of orphanedUsers) {
    console.log(`- Processando usuário: ${user.name} (${user.email})`);
    
    const tenantName = `Empresa de ${user.name.split(' ')[0]}`;
    
    const newTenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        docType: 'AUTO',
        doc: `AUTO_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        plan: 'Gratuito',
        status: 'Ativo',
        apps: gestorNex ? {
          create: [
            { appId: gestorNex.id }
          ]
        } : undefined
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: newTenant.id }
    });

    console.log(`  -> Empresa '${tenantName}' criada e vinculada com sucesso.`);
  }

  console.log('[VARREDURA] Finalizada com sucesso!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
