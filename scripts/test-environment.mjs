export const testEnvironment = {
  ...process.env,
  CHI_TOOLBOX_TEST: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://smoke-test.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'smoke-test-anon-key',
  NEXT_PUBLIC_SITE_URL: 'https://chitoolbox.com',
};
