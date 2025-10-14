import { authAPI } from '@/services/api'
import type { Dispute, DisputeCreateRequest, DisputeQueryParams, DisputeRespondRequest } from '@marketplace/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDisputeStore = defineStore('disputes', () => {
  const disputes = ref<Dispute[]>([])
  const pendingDisputeCount = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch disputes based on view type
   */
  async function fetchDisputes(params: DisputeQueryParams) {
    isLoading.value = true
    error.value = null

    try {
      const response = await authAPI.getDisputes(params)
      disputes.value = response.items

      // Update pending count for seller view
      if (params.view === 'seller') {
        pendingDisputeCount.value = response.items.filter(d => d.status === 'pending').length
      }

      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch disputes'
      console.error('Error fetching disputes:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new dispute
   */
  async function createDispute(request: DisputeCreateRequest) {
    isLoading.value = true
    error.value = null

    try {
      const dispute = await authAPI.createDispute(request)
      disputes.value.unshift(dispute)
      return dispute
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create dispute'
      console.error('Error creating dispute:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Respond to a dispute (seller action)
   */
  async function respondToDispute(request: DisputeRespondRequest) {
    isLoading.value = true
    error.value = null

    try {
      const updatedDispute = await authAPI.respondToDispute(request)

      // Update dispute in local state
      const index = disputes.value.findIndex(d => d.id === request.dispute_id)
      if (index !== -1) {
        disputes.value[index] = updatedDispute
      }

      // Update pending count
      if (updatedDispute.status !== 'pending') {
        pendingDisputeCount.value = Math.max(0, pendingDisputeCount.value - 1)
      }

      return updatedDispute
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to respond to dispute'
      console.error('Error responding to dispute:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh dispute count for seller view
   */
  async function refreshDisputeCount() {
    try {
      const response = await authAPI.getDisputes({
        view: 'seller',
        status: 'pending',
        limit: 100
      })
      pendingDisputeCount.value = response.items.length
    } catch (err) {
      console.error('Error refreshing dispute count:', err)
    }
  }

  /**
   * Get a single dispute by ID from local state
   */
  function getDisputeById(id: string): Dispute | undefined {
    return disputes.value.find(d => d.id === id)
  }

  /**
   * Clear all disputes from state
   */
  function clearDisputes() {
    disputes.value = []
    pendingDisputeCount.value = 0
    error.value = null
  }

  return {
    // State
    disputes,
    pendingDisputeCount,
    isLoading,
    error,

    // Actions
    fetchDisputes,
    createDispute,
    respondToDispute,
    refreshDisputeCount,
    getDisputeById,
    clearDisputes
  }
})
