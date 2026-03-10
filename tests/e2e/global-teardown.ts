import { FullConfig } from '@playwright/test';

/**
 * Global teardown - runs after all tests
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\nPerforming global teardown...');

  // Optional: Clean up test data
  try {
    const apiUrl = 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/test/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      console.log('✓ Test data cleaned up');
    }
  } catch (error) {
    console.log('⚠ Could not clean up test data (optional)');
  }

  console.log('✓ Global teardown completed');
}

export default globalTeardown;
