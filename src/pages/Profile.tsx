import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import type { FamilyMember, FamilyInvite } from '@/types/finance'
import {
  generateFamilyInvite,
  fetchFamilyInvites,
  fetchUserIncompleteFamilies,
  deleteFamilyWorkspaceManually,
} from '@/services/family'
import {
  fetchFamilySettlement,
  buildSettlementSummary,
  type SettlementRow,
} from '@/services/splits'
import { Scale, CreditCard, ExternalLink, ChevronRight } from 'lucide-react'
import {
  fetchMySubscription,
  requestCancelSubscription,
  isSubscriptionActive,
  CHECKOUT_URLS,
  type MySubscription,
} from '@/services/subscription'
import { deleteUserAccount, updateUserName, uploadUserAvatar } from '@/services/user-account'
import { evaluatePasswordStrength, isPasswordStrongEnough } from '@/pages/Login'
import { supabase } from '@/lib/supabase/client'
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  LogOut,
  Loader2,
  DollarSign,
  Camera,
  Check,
  Smartphone,
  Pencil,
  Download,
  Share,
  UserPlus,
  Copy,
  Clock,
  KeyRound,
  Shield,
  ArrowRight,
  ShieldAlert,
  User as UserIcon,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  formatBRL,
  formatFamilyDisplayName,
  formatNumberBRL,
  parseBRLToCents,
  normalizeFamilyName,
} from '@/lib/formatters'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'
import { CategoryManagementDialog } from '@/components/categories/CategoryManagementDialog'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { Sparkles, Landmark, AlertCircle } from 'lucide-react'
import packageJson from '../../package.json'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
