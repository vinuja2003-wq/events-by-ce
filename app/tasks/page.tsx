import TaskBoard from "@/components/TaskBoard";

export default function TasksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <TaskBoard />
    </div>
  );
}