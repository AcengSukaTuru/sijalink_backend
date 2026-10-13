import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Seed demo tidak boleh dijalankan di production.');
}

const prisma = new PrismaClient();
const demoPasswordHash = await hash('SijaLink-Demo-2026!', 12);

try {
  const admin = await prisma.user.upsert({
    where: { email: 'admin.demo@sijalink.test' },
    update: { name: 'Admin Demo', role: 'ADMIN', active: true },
    create: {
      name: 'Admin Demo',
      email: 'admin.demo@sijalink.test',
      passwordHash: demoPasswordHash,
      role: 'ADMIN',
    },
  });
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor.demo@sijalink.test' },
    update: { name: 'Supervisor Demo', role: 'SUPERVISOR', active: true },
    create: {
      name: 'Supervisor Demo',
      email: 'supervisor.demo@sijalink.test',
      passwordHash: demoPasswordHash,
      role: 'SUPERVISOR',
    },
  });
  const technician = await prisma.user.upsert({
    where: { email: 'teknisi.demo@sijalink.test' },
    update: { name: 'Teknisi Demo', role: 'TECHNICIAN', active: true },
    create: {
      name: 'Teknisi Demo',
      email: 'teknisi.demo@sijalink.test',
      passwordHash: demoPasswordHash,
      role: 'TECHNICIAN',
    },
  });

  const routerPusat = await prisma.router.upsert({
    where: { name: 'Router Demo Pusat' },
    update: { status: 'UNKNOWN', lastCheckedAt: null },
    create: {
      name: 'Router Demo Pusat',
      managementAddress: '192.0.2.10',
      location: 'Cabang Pusat (data demo)',
      version: null,
      enabled: true,
      status: 'UNKNOWN',
    },
  });
  const routerTimur = await prisma.router.upsert({
    where: { name: 'Router Demo Timur' },
    update: { status: 'UNKNOWN', lastCheckedAt: null },
    create: {
      name: 'Router Demo Timur',
      managementAddress: '192.0.2.11',
      location: 'Cabang Timur (data demo)',
      version: null,
      enabled: true,
      status: 'UNKNOWN',
    },
  });

  const customerData = [
    {
      accountCode: 'DEMO-C-001',
      name: 'Budi Santoso (Demo)',
      phone: '080000000001',
      address: 'Jl. Contoh Merpati No. 12',
      plan: '50 Mbps',
      status: 'ACTIVE',
      installationDate: new Date('2024-01-12T00:00:00.000Z'),
      pppoeUsername: 'demo-budi@example.test',
      odp: 'ODP-DEMO-01 / Port 4',
      routerId: routerPusat.id,
    },
    {
      accountCode: 'DEMO-C-002',
      name: 'Siti Aminah (Demo)',
      phone: '080000000002',
      address: 'Jl. Contoh Kenanga No. 8',
      plan: '20 Mbps',
      status: 'ACTIVE',
      installationDate: new Date('2024-03-03T00:00:00.000Z'),
      pppoeUsername: 'demo-siti@example.test',
      odp: 'ODP-DEMO-02 / Port 1',
      routerId: routerTimur.id,
    },
    {
      accountCode: 'DEMO-C-003',
      name: 'Andi Pratama (Demo)',
      phone: '080000000003',
      address: 'Jl. Contoh Mawar No. 3',
      plan: '100 Mbps',
      status: 'ISOLATED',
      installationDate: new Date('2023-06-21T00:00:00.000Z'),
      pppoeUsername: 'demo-andi@example.test',
      odp: 'ODP-DEMO-03 / Port 7',
      routerId: routerPusat.id,
    },
    {
      accountCode: 'DEMO-C-004',
      name: 'Dewi Lestari (Demo)',
      phone: '080000000004',
      address: 'Jl. Contoh Anggrek No. 21',
      plan: '30 Mbps',
      status: 'ACTIVE',
      installationDate: new Date('2024-09-15T00:00:00.000Z'),
      pppoeUsername: 'demo-dewi@example.test',
      odp: 'ODP-DEMO-04 / Port 2',
      routerId: routerTimur.id,
    },
  ];
  const customers = await Promise.all(
    customerData.map(({ accountCode, ...data }) =>
      prisma.customer.upsert({
        where: { accountCode },
        update: data,
        create: { accountCode, ...data },
      }),
    ),
  );
  const [budi, siti, andi, dewi] = customers;

  const ticketData = [
    {
      number: 'DEMO-TKT-3001',
      title: 'Koneksi lambat pada jam sibuk',
      description: 'Contoh tiket untuk demonstrasi daftar dan filter.',
      priority: 'NORMAL',
      status: 'NEW',
      customerId: budi.id,
      assigneeId: technician.id,
    },
    {
      number: 'DEMO-TKT-3002',
      title: 'Wi-Fi sering terputus',
      description: 'Contoh tiket yang sedang ditangani.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      customerId: siti.id,
      assigneeId: technician.id,
    },
    {
      number: 'DEMO-TKT-3003',
      title: 'Pengecekan koneksi selesai',
      description: 'Contoh tiket selesai.',
      priority: 'LOW',
      status: 'DONE',
      customerId: dewi.id,
      assigneeId: technician.id,
    },
  ];
  await Promise.all(
    ticketData.map(({ number, ...data }) =>
      prisma.ticket.upsert({
        where: { number },
        update: data,
        create: { number, ...data },
      }),
    ),
  );

  const spkData = [
    {
      number: 'DEMO-SPK-1001',
      workType: 'Pemasangan baru',
      description: 'Contoh pekerjaan pemasangan pelanggan.',
      address: budi.address,
      status: 'NEW',
      customerId: budi.id,
      assigneeId: technician.id,
    },
    {
      number: 'DEMO-SPK-1002',
      workType: 'Pengecekan gangguan',
      description: 'Contoh pekerjaan dalam proses.',
      address: siti.address,
      status: 'IN_PROGRESS',
      customerId: siti.id,
      assigneeId: technician.id,
    },
    {
      number: 'DEMO-SPK-1003',
      workType: 'Pemeriksaan perangkat',
      description: 'Contoh pekerjaan selesai.',
      address: dewi.address,
      status: 'DONE',
      customerId: dewi.id,
      assigneeId: supervisor.id,
    },
    {
      number: 'DEMO-SPK-1004',
      workType: 'Pengecekan jalur',
      description: 'Contoh pekerjaan tanpa assignment.',
      address: andi.address,
      status: 'NEW',
      customerId: andi.id,
      assigneeId: null,
    },
  ];
  const spks = await Promise.all(
    spkData.map(({ number, ...data }) =>
      prisma.spk.upsert({
        where: { number },
        update: data,
        create: { number, ...data },
      }),
    ),
  );

  const businessDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIMEZONE ?? 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const datePart = (type) =>
    businessDateParts.find((part) => part.type === type).value;
  const workDate = new Date(
    Date.UTC(
      Number(datePart('year')),
      Number(datePart('month')) - 1,
      Number(datePart('day')),
    ),
  );
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: technician.id, workDate } },
    update: {},
    create: {
      userId: technician.id,
      workDate,
      checkInAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      checkInLat: -6.2,
      checkInLng: 106.8,
    },
  });

  const notifications = [
    {
      id: 'demo-notification-spk-1001',
      userId: technician.id,
      title: `SPK Baru: ${spks[0].number}`,
      body: `${spks[0].workType} — ${spks[0].address}`,
      spkNumber: spks[0].number,
      readAt: null,
    },
    {
      id: 'demo-notification-spk-1002',
      userId: technician.id,
      title: `SPK Diproses: ${spks[1].number}`,
      body: `${spks[1].workType} — ${spks[1].address}`,
      spkNumber: spks[1].number,
      readAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      id: 'demo-notification-spk-1003',
      userId: supervisor.id,
      title: `SPK Selesai: ${spks[2].number}`,
      body: `${spks[2].workType} — ${spks[2].address}`,
      spkNumber: spks[2].number,
      readAt: null,
    },
  ];
  await Promise.all(
    notifications.map(({ id, ...data }) =>
      prisma.notification.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      }),
    ),
  );

  console.log('Seed demo SijaLink selesai.');
  console.log('Akun demo: admin.demo@sijalink.test / SijaLink-Demo-2026!');
} finally {
  await prisma.$disconnect();
}
