export function SignOutForm() {
  return (
    <form action="/api/auth/signout" method="post">
      <button className="button-secondary w-full" type="submit">
        Cerrar sesion
      </button>
    </form>
  );
}
