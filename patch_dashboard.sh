#!/bin/bash
# First, insert import { useAppSummary } from '../hooks/useAppSummary'; at line 20
sed -i '20i import { useAppSummary } from "../hooks/useAppSummary";' src/components/Dashboard.tsx

# Replace lines 75 to 339
# Find the line numbers for "const transactions =" and "}), [stats]);"
START_LINE=$(grep -n "const transactions = useLiveQuery" src/components/Dashboard.tsx | head -n 1 | cut -d: -f1)
END_LINE=$(grep -n "}), \[stats\]);" src/components/Dashboard.tsx | head -n 1 | cut -d: -f1)

if [ -n "$START_LINE" ] && [ -n "$END_LINE" ]; then
  sed -i "${START_LINE},${END_LINE}c\\
  const {\\
    stats,\\
    appSummary,\\
    transactions,\\
    contacts,\\
    inventoryLogs,\\
    invoices,\\
    orders\\
  } = useAppSummary();" src/components/Dashboard.tsx
  echo "Patched Dashboard.tsx"
else
  echo "Could not find lines"
fi
