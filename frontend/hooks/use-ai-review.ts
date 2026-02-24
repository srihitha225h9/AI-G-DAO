'use client';

import { useState } from 'react';
import { analyzeProposal, AIReviewResult } from '@/lib/gemini';

export function useAIReview() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewResult, setReviewResult] = useState<AIReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeProposalData = async (proposalData: {
    title: string;
    description: string;
    category: string;
    fundingAmount: string;
    expectedImpact: string;
    location: string;
  }, proposalId?: number) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await analyzeProposal(
        proposalData.title,
        proposalData.description,
        proposalData.category,
        proposalData.fundingAmount,
        proposalData.expectedImpact,
        proposalData.location
      );
      setReviewResult(result);

      // Persist analysis to localStorage when a proposalId is provided
      if (proposalId) {
        try {
          localStorage.setItem(`proposal_ai_${proposalId}`, JSON.stringify(result));

          // Update stored proposals aiScore (scale 0-100 -> 0-10)
          const stored = localStorage.getItem('climate_dao_proposals');
          if (stored) {
            const proposals = JSON.parse(stored);
            const idx = proposals.findIndex((p: any) => p.id === proposalId);
            if (idx >= 0) {
              proposals[idx].aiScore = Math.round(result.score / 10);
              localStorage.setItem('climate_dao_proposals', JSON.stringify(proposals));
            }
          }
        } catch (err) {
          console.warn('Failed to persist AI analysis for proposal', proposalId, err);
        }
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearReview = () => {
    setReviewResult(null);
    setError(null);
  };

  return {
    isAnalyzing,
    reviewResult,
    error,
    analyzeProposalData,
    clearReview
  };
}
