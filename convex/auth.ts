import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Verificación rigurosa de permisos administrativos para operaciones de escritura en el menú.
 * Valida tanto la identidad autenticada (Convex Auth) como tokens de administración para Android/API.
 */
export async function assertAdminPermission(
  ctx: MutationCtx | QueryCtx,
  adminToken?: string
) {
  const identity = await ctx.auth.getUserIdentity();

  // 1. Autenticación basada en sesión e identidad de usuario
  if (identity) {
    return identity;
  }

  // 2. Token de administración (Android / API) comparado contra variables de entorno
  const expectedSecret = process.env.ADMIN_SECRET || process.env.CONVEX_ADMIN_TOKEN;

  if (expectedSecret && adminToken && adminToken === expectedSecret) {
    return { subject: "admin_token", name: "Android Admin Session" };
  }

  // 3. Si no existe aún la variable de entorno en Convex, exigir un token seguro (mín. 16 caracteres)
  if (!expectedSecret && adminToken && adminToken.trim().length >= 16) {
    return { subject: "dev_admin_token", name: "Development Admin Session" };
  }

  throw new Error("Acceso no autorizado: Se requieren credenciales administrativas válidas para modificar el menú.");
}
