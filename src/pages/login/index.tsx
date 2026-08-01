import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setIsLoading(true)

    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: { message?: string } } } }
        setError(axiosError.response?.data?.error?.message || 'Login failed. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-screen justify-center bg-transparent font-sans text-[16px] leading-normal text-gray-900 antialiased">
      <section className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <img
                src="/FractalHive_Logo_Website copy.png"
                alt="logo"
                className="h-16 w-16 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">NotifAI</h1>
            <p className="text-sm text-gray-500">By FractalHive Inc.</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Login</h2>
            <p className="mt-1 text-sm text-gray-600">Enter your details below to login</p>
          </div>

          {error && (
            <div className="!m-0 !rounded-lg !border !border-red-300 !bg-red-50 !px-4 !py-3 text-sm text-red-700">
              <p className="!m-0 !font-semibold">Login Failed</p>
              <p className="!m-0 mt-1">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  disabled={isLoading}
                  className="!m-0 !block !h-10 !w-full !appearance-none !rounded-md !border !border-gray-300 !bg-white !px-3 !py-2 !text-sm !font-normal !text-gray-900 !shadow-none !outline-none placeholder:!text-gray-400 focus:!border-gray-400 focus:!ring-2 focus:!ring-gray-300 disabled:!cursor-not-allowed disabled:!opacity-60"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    disabled={isLoading}
                    className="!m-0 !block !h-10 !w-full !appearance-none !rounded-md !border !border-gray-300 !bg-white !px-3 !py-2 !pr-10 !text-sm !font-normal !text-gray-900 !shadow-none !outline-none placeholder:!text-gray-400 focus:!border-gray-400 focus:!ring-2 focus:!ring-gray-300 disabled:!cursor-not-allowed disabled:!opacity-60"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="!m-0 !inline-flex !h-10 !w-full !items-center !justify-center !rounded-md !border-0 !bg-gray-900 !px-4 !py-2 !text-sm !font-semibold !text-white !shadow-none !outline-none hover:!bg-gray-800 focus-visible:!ring-2 focus-visible:!ring-gray-400 disabled:!cursor-not-allowed disabled:!opacity-70"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="text-center text-xs text-gray-500">© 2026 FractalHive</div>
        </div>
      </section>

      <section className="hidden h-screen w-1/2 items-center justify-center lg:flex">
        <div className="h-full w-full p-8">
          <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-[#11b6f6] via-[#2f61f4] to-[#4855f3]">
            <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_24%_82%,#ffd0d7_0%,#f6a0af_40%,transparent_72%)] opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(78%_50%_at_76%_88%,#f6a75d_0%,#ef8f51_34%,transparent_70%)] opacity-95" />
            <div className="absolute inset-0 bg-[radial-gradient(68%_44%_at_50%_62%,#3164f6_0%,#3049eb_56%,transparent_88%)] opacity-90" />
            <div className="absolute -left-24 top-28 h-52 w-56 rounded-full bg-[#95c5ff]/35 blur-3xl" />
            <div className="absolute right-4 top-0 h-72 w-72 rounded-full bg-[#2f99f8]/30 blur-3xl" />
          </div>
        </div>
      </section>
    </div>
  )
}
