import express from "express";
import pg from "pg";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "200kb" }));

// Prevent caching issues - serve static files with no-cache headers
app.use(express.static(new URL("../web", import.meta.url).pathname, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// ---- simple auth (protects write + dashboard endpoints)
function requireToken(req, res, next) {
  const expected = process.env.DASHBOARD_TOKEN;
  const got = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected) return res.status(500).json({ error: "server_not_configured" });
  if (got !== expected) return res.status(401).json({ error: "unauthorized" });
  next();
}

// ---- health
app.get("/health", async (req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- create/update an app
app.post("/api/apps", requireToken, async (req, res) => {
  const { slug, name, repo_url, public_url } = req.body || {};
  if (!slug || !name) return res.status(400).json({ error: "slug_and_name_required" });

  const q = `
    insert into apps (slug, name, repo_url, public_url)
    values ($1,$2,$3,$4)
    on conflict (slug) do update set
      name = excluded.name,
      repo_url = excluded.repo_url,
      public_url = excluded.public_url
    returning *;
  `;
  const { rows } = await pool.query(q, [slug, name, repo_url || null, public_url || null]);
  res.json(rows[0]);
});

// ---- record a deployment
app.post("/api/deployments", requireToken, async (req, res) => {
  const { app_slug, environment = "prod", version, note, deployed_by } = req.body || {};
  if (!app_slug) return res.status(400).json({ error: "app_slug_required" });

  const appRow = await pool.query("select id from apps where slug=$1", [app_slug]);
  const appId = appRow.rows[0]?.id;
  if (!appId) return res.status(404).json({ error: "app_not_found" });

  const { rows } = await pool.query(
    `insert into deployments (app_id, environment, version, note, deployed_by)
     values ($1,$2,$3,$4,$5)
     returning *;`,
    [appId, environment, version || null, note || null, deployed_by || null]
  );

  res.json(rows[0]);
});

// ---- record a usage event (manual logging)
app.post("/api/usage", requireToken, async (req, res) => {
  const { app_slug, kind = "request", method, path, status, ip, user_agent } = req.body || {};
  if (!app_slug) return res.status(400).json({ error: "app_slug_required" });

  const appRow = await pool.query("select id from apps where slug=$1", [app_slug]);
  const appId = appRow.rows[0]?.id;
  if (!appId) return res.status(404).json({ error: "app_not_found" });

  const { rows } = await pool.query(
    `insert into usage_events (app_id, kind, method, path, status, ip, user_agent)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *;`,
    [appId, kind, method || null, path || null, status || null, ip || null, user_agent || null]
  );

  res.json(rows[0]);
});

// ---- dashboard overview (apps + last deploy + hits 24h)
app.get("/api/dashboard/overview", requireToken, async (req, res) => {
  const q = `
    with last_deploy as (
      select distinct on (d.app_id)
        d.app_id, d.deployed_at, d.environment, d.version, d.note
      from deployments d
      order by d.app_id, d.deployed_at desc
    ),
    usage_24h as (
      select app_id, count(*)::int as hits_24h
      from usage_events
      where ts >= now() - interval '24 hours'
      group by app_id
    )
    select
      a.slug, a.name, a.public_url, a.repo_url,
      ld.deployed_at, ld.environment, ld.version, ld.note,
      coalesce(u.hits_24h, 0) as hits_24h
    from apps a
    left join last_deploy ld on ld.app_id = a.id
    left join usage_24h u on u.app_id = a.id
    order by a.name asc;
  `;
  const { rows } = await pool.query(q);
  res.json(rows);
});

// ---- dashboard analytics (usage trends)
app.get("/api/dashboard/analytics", requireToken, async (req, res) => {
  const dailyQ = `
    select 
      date_trunc('day', ts)::date as date,
      count(*)::int as total
    from usage_events
    where ts >= now() - interval '7 days'
    group by date_trunc('day', ts)
    order by date asc;
  `;

  const byAppQ = `
    select 
      a.name as app_name,
      count(*)::int as total
    from usage_events ue
    join apps a on a.id = ue.app_id
    where ue.ts >= now() - interval '7 days'
    group by a.name
    order by total desc
    limit 10;
  `;

  const recentDeploysQ = `
    select count(*)::int as total
    from deployments
    where deployed_at >= now() - interval '7 days';
  `;

  const [daily, byApp, recentDeploys] = await Promise.all([
    pool.query(dailyQ),
    pool.query(byAppQ),
    pool.query(recentDeploysQ)
  ]);

  res.json({
    daily: daily.rows,
    by_app: byApp.rows,
    recent_deployments_count: recentDeploys.rows[0]?.total || 0
  });
});

// ---- dashboard deployment history
app.get("/api/dashboard/deployments", requireToken, async (req, res) => {
  const q = `
    select 
      d.deployed_at,
      d.environment,
      d.version,
      d.note,
      d.deployed_by,
      a.name as app_name,
      a.slug as app_slug
    from deployments d
    join apps a on a.id = d.app_id
    order by d.deployed_at desc
    limit 50;
  `;
  const { rows } = await pool.query(q);
  res.json(rows);
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

