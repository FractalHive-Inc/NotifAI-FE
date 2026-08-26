export function LogoLoader() {
  return (
    <div className="fixed inset-0 flex h-screen w-full items-center justify-center opacity-50">
      <div className="relative">
        <img
          src="/FractalHive_Logo.svg"
          alt="Loading"
          className="size-96 animate-pulse opacity-20 grayscale"
        />
      </div>
    </div>
  )
}
