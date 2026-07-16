import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(priceInLakhs: number): string {
  if (priceInLakhs >= 100) {
    return `₹${(priceInLakhs / 100).toFixed(2)} Cr`
  }
  return `₹${priceInLakhs} L`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num)
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const IPL_TEAMS = [
  { id: 'MI', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0' },
  { id: 'CSK', name: 'Chennai Super Kings', shortName: 'CSK', color: '#FFCB05' },
  { id: 'RCB', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#EC1C24' },
  { id: 'KKR', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D' },
  { id: 'DC', name: 'Delhi Capitals', shortName: 'DC', color: '#0078BC' },
  { id: 'PBKS', name: 'Punjab Kings', shortName: 'PBKS', color: '#ED1B24' },
  { id: 'RR', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85' },
  { id: 'SRH', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#FF822A' },
  { id: 'GT', name: 'Gujarat Titans', shortName: 'GT', color: '#1A3A5C' },
  { id: 'LSG', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#A72056' },
] as const

export type TeamId = typeof IPL_TEAMS[number]['id']

export function getTeamInfo(teamId: TeamId) {
  return IPL_TEAMS.find(t => t.id === teamId) || { 
    id: teamId, 
    name: teamId, 
    shortName: teamId, 
    color: '#64748b' 
  }
}