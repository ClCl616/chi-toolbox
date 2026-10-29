import {
  TimerReset,
  MoonStar,
  CalendarDays,
  NotebookPen,
  GraduationCap,
  BedDouble,
  Dumbbell,
  HardDrive,
  UtensilsCrossed,
  UserRound,
  Settings,
} from 'lucide-react';
import { FocusTimer } from '@/features/focus/components/focus-timer';
import { RoutinesWorkspace } from '@/features/routines/components/routines-workspace';
import { NotesWorkspace } from '@/features/notes/components/notes-workspace';
import { CalendarWorkspace } from '@/features/calendar/components/calendar-workspace';
import { SleepWorkspace } from '@/features/sleep/components/sleep-workspace';
import { WorkoutsWorkspace } from '@/features/workouts/components/workouts-workspace';
import { FilesWorkspace } from '@/features/files/components/files-workspace';
import { MealsWorkspace } from '@/features/meals/components/meals-workspace';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import { SettingsWorkspace } from '@/features/settings/components/settings-workspace';
import { StudyWorkspace } from '@/features/study/components/study-workspace';
// IDs and first nine positions preserve public URLs and Alt+1…9.
export const workspaces = [
  { id: 'focus', label: '타이머', icon: TimerReset, component: FocusTimer },
  {
    id: 'morning',
    label: '루틴 · 할 일',
    icon: MoonStar,
    component: RoutinesWorkspace,
  },
  {
    id: 'calendar',
    label: '캘린더',
    icon: CalendarDays,
    component: CalendarWorkspace,
  },
  { id: 'notes', label: '메모', icon: NotebookPen, component: NotesWorkspace },
  {
    id: 'study',
    label: '복습 · 학습',
    icon: GraduationCap,
    component: StudyWorkspace,
  },
  { id: 'sleep', label: '수면', icon: BedDouble, component: SleepWorkspace },
  {
    id: 'workouts',
    label: '운동',
    icon: Dumbbell,
    component: WorkoutsWorkspace,
  },
  {
    id: 'files',
    label: '드라이브',
    icon: HardDrive,
    component: FilesWorkspace,
  },
  {
    id: 'meals',
    label: '학식',
    icon: UtensilsCrossed,
    component: MealsWorkspace,
  },
  {
    id: 'profile',
    label: '내 프로필',
    icon: UserRound,
    component: ProfileWorkspace,
  },
  {
    id: 'settings',
    label: '설정',
    icon: Settings,
    component: SettingsWorkspace,
  },
];
