@{
    # Existing production identities are deliberately stable across the project rename.
    # Do not move the release tree: active/previous pointers and scheduled tasks use it.
    ProjectName = 'chi-toolbox'
    RuntimeRoot = 'C:\Services\chi-hub-runtime'
    TaskName = 'CHI-HUB-App'
    SourceRoot = 'C:\Services\chi-hub'
    TrashTaskName = 'CHI-HUB-Trash'
    MaintenanceEnvironment = 'C:\Services\chi-hub-maintenance\trash.env'
    CaddyService = 'CHI-HUB-Caddy'
    CaddyRoot = 'C:\Services\chi-hub-caddy'
}
