import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/catalogue.tsx"),
  route("calendar", "routes/calendar.tsx"),
  // Il punto nel nome è letterale, non un separatore di segmenti.
  route("calendar.ics", "routes/calendar[.]ics.tsx"),
  route("signin", "routes/signin.tsx"),
  route("welcome", "routes/welcome.tsx"),
  route("language", "routes/language.tsx"),
  route("requests", "routes/requests.tsx"),
  route("requests/:id", "routes/request-detail.tsx"),
  route("admin/members", "routes/admin.members.tsx"),
  route("admin/requests", "routes/admin.requests.tsx"),
  route("admin/assets", "routes/admin.assets.tsx"),
  route("admin/assets/new", "routes/admin.assets.new.tsx"),
  route("admin/assets/:id", "routes/admin.assets.$id.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("uploads/*", "routes/uploads.tsx"),
  // Tutto l'accesso passa da un solo gestore di Better Auth.
  route("api/auth/*", "routes/api.auth.$.tsx"),
] satisfies RouteConfig;
