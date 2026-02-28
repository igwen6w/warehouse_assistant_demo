import { createApp } from 'vue'
import 'vant/lib/index.css'
import {
  Button,
  Cell,
  CellGroup,
  Field,
  Tabbar,
  TabbarItem,
  NavBar,
  Empty,
  Dialog,
  Toast,
  Loading,
  ActionSheet,
  Popup
} from 'vant'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(Button)
app.use(Cell)
app.use(CellGroup)
app.use(Field)
app.use(Tabbar)
app.use(TabbarItem)
app.use(NavBar)
app.use(Empty)
app.use(Dialog)
app.use(Toast)
app.use(Loading)
app.use(ActionSheet)
app.use(Popup)

app.mount('#app')
