import {Card, CardContent} from "../ui/card"

export default function WelcomeCard(){
    return (
        <Card className="border-0 shadow-sm">
               <CardContent className="p-8">
        <h2 className="text-2xl font-semibold">
          👋 Welcome back
        </h2>

        <p className="mt-2 text-muted-foreground">
          Manage conversations, knowledge and prompts in one AI workspace.
        </p>
      </CardContent>
        </Card>
    )
}