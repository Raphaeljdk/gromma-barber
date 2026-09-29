export async function GET() {
  return Response.json({ ok: true, app: "GROMMA BARBER", time: new Date().toISOString() });
}
