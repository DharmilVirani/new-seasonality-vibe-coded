'use client';

import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function SymbolSelector() {
  const { selectedSymbols, setSelectedSymbols } = useAnalysisStore();

  const { data: symbolsData, isLoading } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols;
    },
  });

  const symbols = symbolsData || [];

  return (
    <div className="space-y-2">
      <Label>Symbol</Label>
      <Select
        value={selectedSymbols[0] || ''}
        onValueChange={(value) => setSelectedSymbols([value])}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select symbol" />
        </SelectTrigger>
        <SelectContent>
          {symbols.map((symbol: { symbol: string; name: string }) => (
            <SelectItem key={symbol.symbol} value={symbol.symbol}>
              {symbol.symbol} {symbol.name && `- ${symbol.name}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
