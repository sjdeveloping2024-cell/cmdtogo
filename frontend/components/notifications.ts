export type BorrowForNotif = {
  id: number;
  book_title: string;
  due_date: string;
  seconds_remaining: number;
};

export async function registerForPushNotifications(): Promise<boolean> {
  return false;
}

export async function scheduleDueNotifications(_borrows: BorrowForNotif[]): Promise<void> {
  // Push notifications not supported in Expo Go SDK 53+
}