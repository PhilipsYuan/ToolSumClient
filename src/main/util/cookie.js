export function setCookie(name, value, expireDays) {
  const date = new Date();
  date.setTime(date.getTime() + expireDays * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}