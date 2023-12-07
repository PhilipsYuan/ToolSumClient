import {Menu, app} from "electron";

const dockMenu = Menu.buildFromTemplate([
    {
        label: 'New Window',
        click () { console.log('New Window') }
    }, {
        label: 'New Window with Settings',
        submenu: [
            { label: 'Basic' },
            { label: 'Pro' }
        ]
    },
    { label: 'New Command...' }
])

app.dock.setMenu(dockMenu)