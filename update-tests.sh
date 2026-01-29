#!/bin/bash

# Update all test files to use TEST_CLIENT_ID from testSetup instead of hardcoded 1

for testfile in server/*.test.ts; do
  echo "Updating $testfile..."
  
  # Add import if not already present
  if ! grep -q "import.*TEST_CLIENT_ID.*from.*testSetup" "$testfile"; then
    sed -i '/^import.*from.*routers/a import { TEST_CLIENT_ID } from "./testSetup";' "$testfile"
  fi
  
  # Replace hardcoded testClientId = 1 with TEST_CLIENT_ID
  sed -i 's/const testClientId = 1;/const testClientId = TEST_CLIENT_ID;/g' "$testfile"
  sed -i 's/testClientId = 1/testClientId = TEST_CLIENT_ID/g' "$testfile"
  
  # Replace direct usage of 1 as clientId
  sed -i 's/clientId: 1,/clientId: TEST_CLIENT_ID,/g' "$testfile"
  sed -i 's/clientId: 1}/clientId: TEST_CLIENT_ID}/g' "$testfile"
  sed -i 's/clientId: 1 /clientId: TEST_CLIENT_ID /g' "$testfile"
done

echo "Done!"
