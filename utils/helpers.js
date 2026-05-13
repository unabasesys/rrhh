
// Compara dos strings y devuelve true si son iguales
export const areStringsEqual = (str1, str2) => {
  const formattedStr1 = str1.trim().toLowerCase().replace(/\s+/g, " ");
  const formattedStr2 = str2.trim().toLowerCase().replace(/\s+/g, " ");

  return formattedStr1 === formattedStr2;
};

// Valida al correo
export const regexEmail = (email) => {
  const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return regex.test(email);
};

// Valida que el password cumpla los requisitos minimos
export const checkValidPassword = (password) => {
  // longitud mínima 8 (cualquier carácter)
  const minLengthRe = /^.{8,}$/;
  // al menos una mayúscula A–Z
  const uppercaseRe = /[A-Z]/;
  // al menos una minúscula a–z
  const lowercaseRe = /[a-z]/;
  // al menos un dígito 0–9
  const digitRe = /\d/;
  // al menos un símbolo de este conjunto
  const specialRe = /[!@#$%^&*(),.?":{}|<>]/;
  // solo permitir letras, dígitos y símbolos listados
  const validCharsRe = /^[A-Za-z\d!@#$%^&*(),.?":{}|<>]+$/;

  return (
    minLengthRe.test(password) &&
    uppercaseRe.test(password) &&
    lowercaseRe.test(password) &&
    digitRe.test(password) &&
    specialRe.test(password) &&
    validCharsRe.test(password)
  );
};

// Validar URL
export const validateURL = (enlace) => {
  try {
    new URL(enlace);
    return true;
  } catch (error) {
    return false;
  }
};

// Validar URL simple
export const validateSimpleURL = (str) => {
  const regex = /[\.]+[a-zA-Z0-9/]+$/;
  return regex.test(str);
};

// Transforma fecha en string a formato YYYY-MM-DD HH:mm:ss en UTC con hora actual
export const transformaDateIsoWithTime = (dateInput) => {
  if (!dateInput) return "-";

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const now = new Date();

  // Mantener la fecha UTC del input, con la hora actual YA en UTC
  const combined = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    ),
  );

  return combined.toISOString();
};

// Transforma fecha en string a formato d MMM, yyyy en español o ingles
export const transformedDate = (dateString) => {
  const globalStore = useGlobalStore();
  const language = globalStore.lang;

  if (!dateString) return "-";

  const date = new Date(dateString);

  // Validar si la fecha es válida
  if (isNaN(date.getTime())) return "-";

  const options = {
    timeZone: useOrganizationStore().organization.country.timezone || "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  const locale = language === "en" ? "en-US" : "es-ES";

  return date.toLocaleDateString(locale, options);
};

// Trabsforma la fecha de Date a string -> yyyy-mm-dd
export const formatDateToYMD = (date = null) => {
  if (date === null) date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Meses van de 0 a 11
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Creacion de ids Randoms
export const generateRandomId = (prefix = "", zeros = 6) => {
  const randomNumber = Math.floor(Math.random() * Math.pow(10, zeros));
  const randomId = `${prefix}${String(randomNumber).padStart(zeros, "0")}`;
  return randomId;
};

// Revisar que todos los campos de un objeto esten completo (devuelve true o false)
export const allPropertiesHaveValue = (object) => {
  for (const property in object) {
    if (object.hasOwnProperty(property) && !object[property]) {
      return false;
    }
  }
  return true;
};

// Para los inputs, solo acepta numeros
export const onlyNumbers = (input) => {
  return input.replace(/[^\d,.\s]/g, "").replace(/\s+/g, "");
};

// Para los inputs, solo acepte numeros sin puntos
export const onlyNumbersWithoutDots = (input) => {
  return input.replace(/[^0-9]/g, "");
};

// Formateador de Porcentajes
export const formatPercentage = (
  input,
  symbolMain = ".",
  secondSymbol = ",",
) => {
  let cleanedInput = input
    .replace(/[,\.](?=.*[,\.])/g, "")
    .replace(/[,\.]/g, symbolMain);

  let [integerPart, decimalPart] = cleanedInput.split(symbolMain);

  decimalPart = decimalPart
    ? (Math.round(parseFloat("0." + decimalPart) * 100) / 100)
        .toFixed(2)
        .slice(2)
    : "00";

  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, secondSymbol);

  let result = integerPart + symbolMain + decimalPart + " %";

  return result;
};

// Generador de ID en base a su fecha de creacion
export const generateIdByDate = (id) => {
  return id + "000" + generateRandomId() + "000" + Date.now();
};

// Formateador de titulos, borra espacios y hace primerla letra de cada palabra en mayuscula
export const formatTitle = (title) => {
  if (title) {
    return title.charAt(0).toUpperCase() + title.slice(1);
  }
  return "";
};
// Solo acepta numeros y letras para los inputs
export const onlyNumbersAndLetters = (input) => {
  const regex = /[^a-zA-Z0-9-_\\.]/g;
  return input.replace(regex, "");
};

// Borra los espacios y solo deja uno ('         hola    hola   ' -> 'hola hola')
export const removeExtraSpaces = (string) => {
  string = string.trim();
  return string.split(/\s+/).join(" ");
};

//Formateador de fecha normal 2024-07-09T21:52:09.825Z -> 09/07/2024
export const formatNormalDate = (isoDate) => {
  const date = new Date(isoDate);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatReverseDate = (isoDate) => {
  const date = new Date(isoDate);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
};

//Primera letra de cada palabra la hace mayuscula para los nombres sin importar los caracteres especiales
export const capitalizeName = (fullName) => {
  return fullName
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const match = word.match(/[a-záéíóúüñ]/i);
      if (match) {
        const index = match.index;
        return (
          word.slice(0, index) +
          word.charAt(index).toUpperCase() +
          word.slice(index + 1)
        );
      }
      return word;
    })
    .join(" ");
};

//Solo la primera letra de un string la transforma a mayuscula
export const capitalizeFirstLetter = (str) => {
  if (!str || typeof str !== "string") {
    return "";
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const convertirTime = (fechaISO) => {
  if (fechaISO) {
    const fecha = new Date(fechaISO);

    let horas = fecha.getUTCHours();
    let minutos = fecha.getUTCMinutes();

    // Determinar AM o PM
    const periodo = horas >= 12 ? "PM" : "AM";

    // Convertir horas a formato de 12 horas
    horas = horas % 12;
    horas = horas ? horas : 12;

    // Formatear minutos con dos dígitos
    minutos = minutos < 10 ? "0" + minutos : minutos;

    // Construir la cadena de hora formateada
    const horaFormateada = `${horas}:${minutos} ${periodo}`;

    return horaFormateada;
  }

  return "--:-- m";
};

// Complemento para los buscadores
export const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      await func.apply(context, args);
    }, wait);
  };
};

// Cambiar tema
export const changeTheme = (theme = "dark") => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark-theme");
    document.documentElement.classList.remove("light-theme");
  } else {
    document.documentElement.classList.remove("dark-theme");
    document.documentElement.classList.add("light-theme");
  }
};

// Devuelve el año y en mes actual en un objeto
// @return { year: number, month: number }
export const getCurrentDateAndTimeZone = () => {
  const now = new Date();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    zone,
  };
};

export const getCurrentYearAndTimeZone = () => {
  const now = new Date();
  const zone =
    useOrganizationStore().organization.country.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    year: now.getFullYear(),
    month: null,
    zone,
    prop: null,
  };
};

// Devuelve los nueve ultimos años a partir de un año recibido como parametro
// @return [number, number ... 9 veces]
export const generateDescendingArray = (endNumber) => {
  return Array.from({ length: 9 }, (_, i) => endNumber - (8 - i));
};

// Genera variantes en un 10%, 60% y 80% más claras
export const generateLighterVariants = (hex) => {
  // Convierte un color hexadecimal a RGB
  const hexToRgb = (hex) => {
    const cleanHex = hex.replace("#", "");
    const bigint = parseInt(cleanHex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  };

  // Convierte un color RGB a hexadecimal
  const rgbToHex = ({ r, g, b }) => {
    return `#${[r, g, b]
      .map((val) => val.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  // Aumenta la luminosidad del color basado en un porcentaje
  const lightenColor = ({ r, g, b }, percentage) => {
    const lighten = (value) =>
      Math.round(value + (255 - value) * (percentage / 100));
    return {
      r: lighten(r),
      g: lighten(g),
      b: lighten(b),
    };
  };

  const rgb = hexToRgb(hex);

  // Genera variantes en un 10%, 60% y 80% más claras
  const percentages = [10, 70, 80];
  const lighterVariants = percentages.map((percentage) =>
    rgbToHex(lightenColor(rgb, percentage)),
  );

  return lighterVariants;
};

export const dateToIso = (date) => {
  const utcDate = new Date(date);
  return utcDate.toISOString().split("T")[0];
};

export const formatNumberByMiniGrid = (text, precision, symbol = ",") => {
  // Validar que el símbolo sea válido
  if (symbol !== "," && symbol !== ".") {
    symbol = ",";
  }

  // Eliminar espacios y caracteres no numéricos permitidos
  let cleanedText = text.replace(/[^0-9,\.]/g, "");

  // Identificar el primer separador decimal (, o .)
  let separatorIndex = Math.max(
    cleanedText.indexOf(","),
    cleanedText.indexOf("."),
  );

  if (separatorIndex !== -1) {
    // Tomar la parte entera y decimal con el primer separador encontrado
    let integerPart = cleanedText.slice(0, separatorIndex);
    let decimalPart = cleanedText
      .slice(separatorIndex + 1)
      .replace(/[^0-9]/g, "");

    // Redondear la parte decimal según la precisión
    if (precision > 0) {
      let roundedDecimal = (parseFloat("0." + decimalPart) || 0)
        .toFixed(precision)
        .slice(precision);
      return `${integerPart}${symbol}${roundedDecimal}`;
    } else {
      return integerPart;
    }
  }

  // Si no hay separadores, devolver el número tal cual
  return cleanedText;
};

// Google Maps
export const searchLocationByGoogleMaps = async (config) => {
  const {
    str, // Texto de búsqueda (REQUERIDO)
    type, // 'country', 'city', 'street' (REQUERIDO)
    countryCode, // Código del país ISO (opcional, para ciudad/calle)
  } = config;

  // Importar la biblioteca de lugares
  const { AutocompleteSuggestion, Place } =
    await google.maps.importLibrary("places");

  // Crear el objeto de solicitud
  const request = {
    input: str,
  };

  // Configurar tipos según el caso
  if (type === "country") {
    // Para países: no usar includedPrimaryTypes, filtraremos manualmente
    // No agregar nada especial
  } else if (type === "city") {
    // Para ciudades: no usar includedPrimaryTypes, filtraremos manualmente
    // Agregar filtro de país si existe
    if (countryCode) {
      request.includedRegionCodes = [countryCode];
    }
  } else if (type === "street") {
    // CLAVE: Para calles necesitas MÚLTIPLES tipos
    // street_address solo no es suficiente
    request.includedPrimaryTypes = [
      "premise", // Edificios específicos
      "subpremise", // Sub-edificios (apartamentos, oficinas)
      "street_address", // Direcciones completas
      "route", // Nombres de calles
    ];

    // Agregar filtro de país si existe
    if (countryCode) {
      request.includedRegionCodes = [countryCode];
    }
  }

  try {
    // Realizar la búsqueda
    const { suggestions } =
      await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

    // Filtrar manualmente por tipo
    let filteredSuggestions = suggestions;

    if (type === "country") {
      // Filtrar solo países
      filteredSuggestions = suggestions.filter((suggestion) => {
        const types = suggestion.placePrediction.types || [];
        return types.includes("country");
      });
    } else if (type === "city") {
      // Filtrar solo ciudades
      filteredSuggestions = suggestions.filter((suggestion) => {
        const types = suggestion.placePrediction.types || [];
        return (
          types.includes("locality") ||
          types.includes("administrative_area_level_3") ||
          types.includes("postal_town")
        );
      });
    }

    // Mapear los resultados
    const results = await Promise.all(
      filteredSuggestions.map(async (suggestion) => {
        const placePrediction = suggestion.placePrediction;

        // Para calles, solo devolver el array simple con label
        if (type === "street") {
          return {
            label: placePrediction.text.text,
            place_id: placePrediction.placeId,
          };
        }

        // Para países y ciudades, incluir toda la información
        const result = {
          label: placePrediction.text.text,
          place_id: placePrediction.placeId,
          mainText: placePrediction.structuredFormat?.mainText?.text || "",
          secondaryText:
            placePrediction.structuredFormat?.secondaryText?.text || "",
        };

        // Si es búsqueda de país, obtener el código del país
        if (type === "country") {
          try {
            const place = new Place({
              id: placePrediction.placeId,
            });

            await place.fetchFields({
              fields: ["addressComponents"],
            });

            const countryComponent = place.addressComponents?.find(
              (component) => component.types.includes("country"),
            );

            if (countryComponent) {
              result.countryCode = countryComponent.shortText;
              result.countryName = countryComponent.longText;
            }
          } catch (error) {
            console.warn("No se pudo obtener el código del país:", error);
          }
        }

        return result;
      }),
    );

    return results;
  } catch (error) {
    console.error("Error al buscar ubicaciones:", error);
    return [];
  }
};

export function testGoogleMapsPlaces() {
  return new Promise((resolve) => {
    try {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        return resolve(false);
      }

      const service = new google.maps.places.AutocompleteService();

      service.getPlacePredictions({ input: "test" }, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (err) {
      console.error("Error verificando Google Places:", err);
      resolve(false);
    }
  });
}

// Validar y evaluar una fórmula matemática
export const evaluateFormula = (formulaStr) => {
  const resultObject = {
    success: false,
    value: null,
  };

  if (!formulaStr || typeof formulaStr !== "string") return resultObject;

  let processedFormula = formulaStr.trim();

  // Solo permite caracteres matemáticos válidos
  const mathRegex = /^[0-9+\-*/().\s%^√πe]+$/;
  if (!mathRegex.test(processedFormula)) return resultObject;

  // Detectar más de 2 operadores seguidos (no permitido)
  if (/[+\-\/^%]{3,}/.test(processedFormula)) return resultObject;

  // Corregir operadores duplicados (solo si hay 2)
  processedFormula = processedFormula
    .replace(/\+{2}/g, "+")
    .replace(/\-{2}/g, "-")
    .replace(/\/{2}/g, "/")
    .replace(/\^{2}/g, "^")
    .replace(/%{2}/g, "%");

  // Contar paréntesis
  let openCount = 0;
  let closeCount = 0;
  for (let char of processedFormula) {
    if (char === "(") openCount++;
    if (char === ")") closeCount++;
  }

  // Si hay paréntesis de cierre sin apertura → fórmula inválida
  if (closeCount > openCount) return resultObject;

  // Si hay paréntesis de apertura sin cierre → eliminar los sobrantes desde el final
  if (openCount > closeCount) {
    let excessOpen = openCount - closeCount;
    for (let i = processedFormula.length - 1; i >= 0 && excessOpen > 0; i--) {
      if (processedFormula[i] === "(") {
        processedFormula =
          processedFormula.slice(0, i) + processedFormula.slice(i + 1);
        excessOpen--;
      }
    }
  }

  // Eliminar paréntesis vacíos
  processedFormula = processedFormula.replace(/\(\s*\)/g, "");

  // Limpiar operadores al inicio o final (excepto - al inicio)
  processedFormula = processedFormula.replace(/^[\s][+/^%]+/, "");
  processedFormula = processedFormula.replace(/[+\-/^%]+[\s]$/, "");

  processedFormula = processedFormula.trim();
  if (!processedFormula) return resultObject;

  // Reemplazo de símbolos especiales
  processedFormula = processedFormula
    .replace(/π/g, "Math.PI")
    .replace(/e/g, "Math.E")
    .replace(/√/g, "Math.sqrt")
    .replace(/\^/g, "**");

  try {
    const value = eval(processedFormula);
    if (typeof value === "number" && isFinite(value)) {
      resultObject.success = true;
      resultObject.value = value;
    }
  } catch (err) {
    // Error al evaluar, simplemente devolvemos success: false
  }

  return resultObject;
};

// Fecha
export const formatDateString = (fechaIso, lang = "es") => {
  const date = new Date(fechaIso);

  const months = {
    es: [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ],
    en: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
  };

  const day = date.getDate();
  const month = months[lang][date.getMonth()];
  const year = date.getFullYear();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (lang === "es") {
    return `${day} de ${month}, ${year} a las ${hours}:${minutes} hrs`;
  } else {
    return `${month} ${day}, ${year} at ${hours}:${minutes} hrs`;
  }
};

export const getColorStatus = (status) => {
  const options = {
    voided: {
      background: "--danger-surface-shadow-12a",
      color: "--danger-text-darker",
    },
    forApproval: {
      background: "--warning-surface-shadow-12a",
      color: "--warning-text-darker",
    },
    inProcess: {
      background: "--info-surface-shadow-12a",
      color: "--info-text-darker",
    },
    closed: {
      background: "--secondary-surface-shadow-8a",
      color: "--secondary-text-darker",
    },
    paid: {
      background: "--primary-surface-shadow-12a",
      color: "--primary-text-default",
    }, 
    rejected: {
      background: "--neutral-surface-harder",
      color: "--neutral-text-caption",
    },
    default: {
      background: "--neutral-surface-shadow-12a",
      color: "--neutral-text-darker",
    }
  }

  return options[status] || options.default;
};

export const getNameStatus = (status, t) => { 
  const LABEL_KEY = "global.status";
  const options = {
    voided: t(`${LABEL_KEY}.voided`),
    forApproval: t(`${LABEL_KEY}.forApproval`),
    inProcess: t(`${LABEL_KEY}.inProcess`),
    closed: t(`${LABEL_KEY}.closed`),
    paid: t(`${LABEL_KEY}.paid`),
    rejected: t(`${LABEL_KEY}.rejected`),
    default: t(`${LABEL_KEY}.default`)
  };

  return options[status] || options.default;
};

// Focus a un input por su id
export const focusById = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
  }
};
// Convierte a mayusculas, solo letras y numeros, no espacios y el primer caracter debe ser una letra
export const handleAbbreviation = (e) => {
  let v = e.target.value.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
  
  e.target.value = v.length && !/^[A-Z]/.test(v) ? v.substring(1) : v;
};
