import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex justify-center pt-[8vh]">
      <SignIn />
    </div>
  );
}
