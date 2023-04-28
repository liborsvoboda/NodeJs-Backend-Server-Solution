module.exports = (sequelize, type) => {
  return sequelize.define('topvariables', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
        type: type.UUID,
        allowNull: false,
        defaultValue: type.UUIDV4
    },
    parameter: {
      type: type.STRING(10),
      allowNull: false,
    },
    paramMaxLength: {
      type: type.INTEGER,
      allowNull: false
    },
    created: {
        type: type.STRING(255),
        allowNull: true
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'uuid_tvfk_idx',
        fields: ['uuid']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
