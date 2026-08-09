interface Props {
  title:string;
  greeting?: string;
  description:string;
}

export default function WorkspaceHeader({
    title,
    greeting,
    description,
}:Props) {
    return (
        <div>
      <h1 className="text-3xl font-bold tracking-tight">
        {title}
      </h1>
      {greeting && (
        <p className="mt-1 text-muted-foreground">
          {greeting}
        </p>
      )}
      <p className="mt-1 text-muted-foreground">
        {description}
      </p>
    </div>
    )
}
